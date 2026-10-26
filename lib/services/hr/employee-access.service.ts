import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Employee, type IEmployee } from "@/lib/models/employee";
import { Mailbox, type IMailbox } from "@/lib/models/mailbox";
import { User } from "@/lib/models/user";
import type { Lean } from "@/lib/models/_shared";
import {
  createUser,
  findUserByEmail,
  findUserById,
  setUserDisabled,
} from "@/lib/repositories/users.repo";
import { hashPassword } from "@/lib/auth/password";
import { signInviteToken } from "@/lib/auth/tokens";
import { getMailer } from "@/lib/mailer";
import { renderEmail } from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { logger } from "@/lib/log";
import { vaultConfigured } from "@/lib/crypto/vault";
import {
  businessAddress,
  DEFAULT_MAILBOX_QUOTA_BYTES,
  isValidLocalPart,
  normaliseLocalPart,
  quotaLabel,
} from "@/lib/mail/address";
import { mailDomain } from "@/lib/mail/config";
import {
  decryptMailboxPassword,
  encryptMailboxPassword,
  generateMailboxPassword,
} from "@/lib/mail/credentials";
import { getMailProvisioner, MailProvisionError } from "@/lib/mail/provisioner";
import type { z } from "zod";
import type { employeeCreateWithAccessSchema } from "@/lib/schemas/hr";
import {
  createEmployee,
  getEmployee,
  type Actor,
  type HrResult,
} from "./employee.service";

/**
 * One person, one company address: the portal login and the mailbox behind
 * `name@spibermed.com`, created together with the Employee record.
 *
 * Every step is idempotent, so a failure part-way (the mail server down while
 * the login was fine) is repaired by calling `provisionEmployeeAccess` again
 * from the employee page — nothing is rolled back, nothing is duplicated.
 * The invite goes to the PERSONAL address, because the person cannot read
 * their new mailbox before they can sign in.
 */

export type AccessError =
  | "not_found"
  | "invalid_address"
  | "address_taken"
  /** A login with that address exists and belongs to someone else. */
  | "login_taken"
  /** No COMPANY_VAULT_KEY — the mailbox password could not be stored safely. */
  | "vault_not_configured"
  | "provisioner_not_configured"
  /** The mail server refused or was unreachable; the row says why. */
  | "provision_failed"
  | "no_business_email"
  | "no_login";

export type AccessResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AccessError; detail?: string };

const fail = (code: AccessError, detail?: string): AccessResult<never> => ({
  ok: false,
  code,
  detail,
});
const done = <T>(data: T): AccessResult<T> => ({ ok: true, data });

async function logEmployee(
  employeeId: string,
  actorId: string | null,
  action: string,
  note?: string | null,
) {
  await Employee.updateOne(
    { _id: employeeId },
    {
      $push: {
        activity: {
          $each: [{ at: new Date(), actorId, action, note: note ?? null }],
          $slice: -200,
        },
      },
    },
  ).exec();
}

async function logMailbox(
  mailboxId: unknown,
  actorId: string | null,
  action: string,
  note?: string | null,
) {
  await Mailbox.updateOne(
    { _id: mailboxId },
    {
      $push: {
        activity: {
          $each: [{ at: new Date(), actorId, action, note: note ?? null }],
          $slice: -200,
        },
      },
    },
  ).exec();
}

// ───────────────────────────── availability ─────────────────────────────

export type Availability =
  | { available: true; address: string }
  | {
      available: false;
      address: string;
      reason: "invalid" | "employee" | "login" | "mailbox" | "server";
    };

/**
 * Is `local@domain` free? Checked against employees, logins, mailbox rows and
 * the mail server itself (info@ exists there with no row of its own).
 */
export async function checkBusinessEmail(local: string): Promise<Availability> {
  const normalised = normaliseLocalPart(local);
  const address = businessAddress(normalised, mailDomain());
  if (!isValidLocalPart(normalised)) {
    return { available: false, address, reason: "invalid" };
  }
  await connectToDatabase();
  const [employee, user, mailbox] = await Promise.all([
    Employee.exists({ businessEmail: address, deletedAt: null }),
    findUserByEmail(address),
    Mailbox.exists({ address, deletedAt: null }),
  ]);
  if (employee) return { available: false, address, reason: "employee" };
  if (mailbox) return { available: false, address, reason: "mailbox" };
  // A login with this address that is not yet an employee (the super admin
  // adding themselves) can be linked; one that belongs to a customer cannot.
  if (user && user.roles.some((r) => r === "customer" || r === "seller")) {
    return { available: false, address, reason: "login" };
  }
  try {
    if (await getMailProvisioner().get(address)) {
      return { available: false, address, reason: "server" };
    }
  } catch (e) {
    // Unreachable server: report free and let provisioning say otherwise.
    logger.warn("mail provisioner check failed", { address, error: String(e) });
  }
  return { available: true, address };
}

// ───────────────────────────── provisioning ─────────────────────────────

export type ProvisionOutcome = {
  employee: Lean<IEmployee>;
  mailbox: Lean<IMailbox>;
  userId: string;
  /** Set when a brand-new login was created and an invite issued. */
  inviteLink: string | null;
  /** Whether that invite was actually emailed (needs a personal address). */
  inviteEmailed: boolean;
  /** The login already existed and was linked rather than created. */
  linkedExistingLogin: boolean;
};

/**
 * Create (or repair) everything behind an employee's business email:
 *   1. the mailbox row + the account on the mail server
 *   2. the portal login (role `employee`), or a link to an existing one
 *   3. the set-password invite, when the login is new
 */
export async function provisionEmployeeAccess(
  employeeId: string,
  actor: Actor,
  opts: { sendInvite?: boolean; quotaBytes?: number } = {},
): Promise<AccessResult<ProvisionOutcome>> {
  await connectToDatabase();
  const employee = await getEmployee(employeeId);
  if (!employee) return fail("not_found");
  const address = employee.businessEmail;
  if (!address) return fail("no_business_email");
  if (!vaultConfigured()) return fail("vault_not_configured");

  let provisioner;
  try {
    provisioner = getMailProvisioner();
  } catch (e) {
    return fail("provisioner_not_configured", String(e));
  }

  // 1. mailbox
  let mailbox = await Mailbox.findOne({ address, deletedAt: null })
    .lean<Lean<IMailbox>>()
    .exec();
  if (mailbox && String(mailbox.employeeId ?? "") !== String(employee._id)) {
    return fail("address_taken");
  }
  if (!mailbox) {
    const created = await Mailbox.create({
      address,
      kind: "personal",
      status: "pending",
      employeeId: employee._id,
      quotaBytes: opts.quotaBytes ?? DEFAULT_MAILBOX_QUOTA_BYTES,
      activity: [
        { at: new Date(), actorId: actor.sub, action: "created", note: null },
      ],
    });
    mailbox = created.toObject() as Lean<IMailbox>;
  }
  if (mailbox.status !== "active" && mailbox.status !== "disabled") {
    const password = generateMailboxPassword();
    try {
      await provisioner.create({
        address,
        password,
        quota: quotaLabel(mailbox.quotaBytes ?? DEFAULT_MAILBOX_QUOTA_BYTES),
      });
    } catch (e) {
      if (e instanceof MailProvisionError && e.code === "exists") {
        // Someone created it by hand on the server. Take it over: set a
        // password we know, so the stored one is real.
        try {
          await provisioner.setPassword(address, password);
        } catch (inner) {
          return await markFailed(mailbox, employee, actor, inner);
        }
      } else {
        return await markFailed(mailbox, employee, actor, e);
      }
    }
    const updated = await Mailbox.findOneAndUpdate(
      { _id: mailbox._id },
      {
        $set: {
          status: "active",
          passwordCiphertext: encryptMailboxPassword(password),
          provider: provisioner.name,
          provisionedAt: new Date(),
          provisionedBy: actor.sub,
          lastError: null,
        },
      },
      { returnDocument: "after" },
    )
      .lean<Lean<IMailbox>>()
      .exec();
    mailbox = updated!;
    await logMailbox(mailbox._id, actor.sub, "provisioned", provisioner.name);
    await logEmployee(
      employeeId,
      actor.sub,
      "mailbox.provisioned",
      `${address} on ${provisioner.name === "http" ? mailDomain() : "a simulated server"}`,
    );
  }

  // 2. login
  let userId = employee.userId ? String(employee.userId) : null;
  let inviteLink: string | null = null;
  let inviteEmailed = false;
  let linkedExistingLogin = false;
  let loginIsNew = false;
  if (!userId) {
    const existing = await findUserByEmail(address);
    if (existing) {
      const otherEmployee = await Employee.exists({
        userId: existing._id,
        deletedAt: null,
        _id: { $ne: employee._id },
      });
      if (otherEmployee) return fail("login_taken");
      await User.updateOne(
        { _id: existing._id },
        { $addToSet: { roles: "employee" } },
      ).exec();
      userId = String(existing._id);
      linkedExistingLogin = true;
      await logEmployee(
        employeeId,
        actor.sub,
        "login.linked",
        `existing login ${address}`,
      );
    } else {
      // An unusable random password: the only way in is the invite link.
      const created = await createUser({
        name: employee.name,
        email: address,
        passwordHash: await hashPassword(generateMailboxPassword()),
        roles: ["employee"],
        locale: "en",
      });
      await User.updateOne(
        { _id: created._id },
        { $set: { emailVerified: true } },
      ).exec();
      userId = String(created._id);
      loginIsNew = true;
      await logEmployee(employeeId, actor.sub, "login.created", address);
    }
    await Employee.updateOne(
      { _id: employee._id },
      { $set: { userId: new mongoose.Types.ObjectId(userId) } },
    ).exec();
  }
  if (!mailbox.ownerUserId || String(mailbox.ownerUserId) !== userId) {
    await Mailbox.updateOne(
      { _id: mailbox._id },
      { $set: { ownerUserId: new mongoose.Types.ObjectId(userId) } },
    ).exec();
  }

  // 3. invite
  if (loginIsNew && (opts.sendInvite ?? true)) {
    const inv = await sendInvite(employeeId, actor);
    if (inv.ok) {
      inviteLink = inv.data.link;
      inviteEmailed = inv.data.emailed;
    }
  }

  const fresh = await getEmployee(employeeId);
  const box = await Mailbox.findById(mailbox._id).lean<Lean<IMailbox>>().exec();
  return done({
    employee: fresh!,
    mailbox: box!,
    userId,
    inviteLink,
    inviteEmailed,
    linkedExistingLogin,
  });
}

async function markFailed(
  mailbox: Lean<IMailbox>,
  employee: Lean<IEmployee>,
  actor: Actor,
  e: unknown,
): Promise<AccessResult<never>> {
  const detail =
    e instanceof MailProvisionError ? e.message : `unexpected: ${String(e)}`;
  logger.error("mailbox provisioning failed", {
    address: mailbox.address,
    error: detail,
  });
  await Mailbox.updateOne(
    { _id: mailbox._id },
    { $set: { status: "failed", lastError: detail } },
  ).exec();
  await logMailbox(mailbox._id, actor.sub, "provision.failed", detail);
  await logEmployee(String(employee._id), actor.sub, "mailbox.failed", detail);
  if (e instanceof MailProvisionError && e.code === "not_configured") {
    return fail("provisioner_not_configured", detail);
  }
  return fail("provision_failed", detail);
}

/**
 * Create the Employee record and, in the same request, its mailbox, login
 * and invite. The address is checked BEFORE the record is written so a
 * taken address fails with nothing saved; a mail-server failure afterwards
 * leaves the record with a "Retry" on its page rather than losing the person.
 */
export async function createEmployeeWithAccess(
  input: z.infer<typeof employeeCreateWithAccessSchema>,
  actor: Actor,
): Promise<
  | {
      ok: true;
      data: {
        employee: Lean<IEmployee>;
        access: AccessResult<ProvisionOutcome>;
      };
    }
  | {
      ok: false;
      code:
        | AccessError
        | "pool_exceeded"
        | "no_pool"
        | "bad_schedule"
        | "duplicate_user"
        | "not_found";
      detail?: string;
    }
> {
  const availability = await checkBusinessEmail(input.businessEmailLocal);
  if (!availability.available) {
    return availability.reason === "invalid"
      ? { ok: false, code: "invalid_address" }
      : { ok: false, code: "address_taken", detail: availability.reason };
  }
  if (!vaultConfigured()) return { ok: false, code: "vault_not_configured" };

  const created: HrResult<Lean<IEmployee>> = await createEmployee(
    { ...input, businessEmail: availability.address },
    actor,
  );
  if (!created.ok) return { ok: false, code: created.code };

  const access = await provisionEmployeeAccess(
    String(created.data._id),
    actor,
    {
      sendInvite: input.sendInvite ?? true,
    },
  );
  const employee = access.ok ? access.data.employee : created.data;
  return { ok: true, data: { employee, access } };
}

/**
 * Give a record from before unified mail its company address, then build
 * everything behind it exactly as a new record would get. The address is
 * written only if the record still has none (atomic), so two admins cannot
 * race it onto one person.
 */
export async function assignBusinessEmail(
  employeeId: string,
  local: string,
  actor: Actor,
): Promise<AccessResult<ProvisionOutcome>> {
  await connectToDatabase();
  const employee = await getEmployee(employeeId);
  if (!employee) return fail("not_found");
  if (employee.businessEmail) return fail("address_taken", "already assigned");
  const availability = await checkBusinessEmail(local);
  if (!availability.available) {
    return availability.reason === "invalid"
      ? fail("invalid_address")
      : fail("address_taken", availability.reason);
  }
  if (!vaultConfigured()) return fail("vault_not_configured");
  const res = await Employee.updateOne(
    { _id: employee._id, deletedAt: null, businessEmail: null },
    { $set: { businessEmail: availability.address } },
  ).exec();
  if (res.matchedCount === 0) return fail("address_taken", "already assigned");
  await logEmployee(
    employeeId,
    actor.sub,
    "address.assigned",
    availability.address,
  );
  return provisionEmployeeAccess(employeeId, actor);
}

// ───────────────────────────── invites ─────────────────────────────

/**
 * Issue a fresh set-password link (24 h, single-use) and mail it to the
 * personal address. Returns the link either way, so it can be copied when
 * the person has no personal email on file or the mail bounced.
 */
export async function sendInvite(
  employeeId: string,
  actor: Actor,
): Promise<AccessResult<{ link: string; emailed: boolean }>> {
  await connectToDatabase();
  const employee = await getEmployee(employeeId);
  if (!employee) return fail("not_found");
  if (!employee.userId) return fail("no_login");
  const user = await findUserById(String(employee.userId));
  if (!user) return fail("no_login");

  const token = await signInviteToken(String(user._id), user.tokenVersion ?? 0);
  const link = `${siteConfig.url}/en?auth=reset&token=${encodeURIComponent(token)}&invite=1`;

  let emailed = false;
  const to = employee.email?.trim();
  if (to) {
    const mail = renderEmail({
      accent: "teal",
      preheader: `Set your password for the ${siteConfig.brand} portal.`,
      eyebrow: "Welcome",
      heading: `Your ${siteConfig.brand} account`,
      greetingName: employee.name,
      paragraphs: [
        `You have a ${siteConfig.brand} account and a company mailbox: ${employee.businessEmail}. Choose a password to start using both.`,
      ],
      button: { label: "Set my password", url: link },
      outro: [
        "This link works for 24 hours and once. If it has expired, ask the office to send a new one.",
      ],
    });
    try {
      await getMailer().send({
        to,
        subject: `Welcome to ${siteConfig.brand} — set your password`,
        html: mail.html,
        text: mail.text,
        attachments: mail.attachments,
      });
      emailed = true;
    } catch (e) {
      logger.error("invite email failed", { to, error: String(e) });
    }
  }
  await Employee.updateOne(
    { _id: employee._id },
    { $set: { invitedAt: new Date() } },
  ).exec();
  await logEmployee(
    employeeId,
    actor.sub,
    "invite.sent",
    emailed ? `to ${to}` : "link copied (no personal email)",
  );
  return done({ link, emailed });
}

/** Called when an invite token sets a password. */
export async function markInviteAccepted(userId: string): Promise<void> {
  await connectToDatabase();
  const employee = await Employee.findOne({ userId, deletedAt: null })
    .select("_id")
    .lean<{ _id: unknown }>()
    .exec();
  if (!employee) return;
  await Employee.updateOne(
    { _id: employee._id },
    { $set: { inviteAcceptedAt: new Date() } },
  ).exec();
  await logEmployee(String(employee._id), null, "invite.accepted");
}

// ───────────────────────────── login & mailbox controls ─────────────────────────────

export async function setEmployeeLoginDisabled(
  employeeId: string,
  disabled: boolean,
  actor: Actor,
): Promise<AccessResult<{ disabled: boolean }>> {
  await connectToDatabase();
  const employee = await getEmployee(employeeId);
  if (!employee) return fail("not_found");
  if (!employee.userId) return fail("no_login");
  await setUserDisabled(String(employee.userId), disabled);
  await logEmployee(
    employeeId,
    actor.sub,
    disabled ? "login.disabled" : "login.enabled",
  );
  return done({ disabled });
}

export async function mailboxForEmployee(
  employeeId: string,
): Promise<Lean<IMailbox> | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(employeeId)) return null;
  return Mailbox.findOne({ employeeId, deletedAt: null })
    .lean<Lean<IMailbox>>()
    .exec();
}

/** The mailbox's own password, for a phone or desktop client. Audited by the route. */
export async function revealMailboxPassword(
  employeeId: string,
  actor: Actor,
): Promise<AccessResult<{ address: string; password: string }>> {
  const mailbox = await mailboxForEmployee(employeeId);
  if (!mailbox) return fail("not_found");
  if (!mailbox.passwordCiphertext)
    return fail("provision_failed", "no password stored");
  if (!vaultConfigured()) return fail("vault_not_configured");
  const password = decryptMailboxPassword(mailbox.passwordCiphertext);
  await logMailbox(mailbox._id, actor.sub, "password.revealed");
  await logEmployee(employeeId, actor.sub, "mailbox.password_revealed");
  return done({ address: mailbox.address, password });
}

/** New random password on the server and in the vault (old clients drop off). */
export async function resetMailboxPassword(
  employeeId: string,
  actor: Actor,
): Promise<AccessResult<{ address: string; password: string }>> {
  const mailbox = await mailboxForEmployee(employeeId);
  if (!mailbox) return fail("not_found");
  if (!vaultConfigured()) return fail("vault_not_configured");
  const password = generateMailboxPassword();
  try {
    await getMailProvisioner().setPassword(mailbox.address, password);
  } catch (e) {
    const detail = e instanceof MailProvisionError ? e.message : String(e);
    return fail(
      e instanceof MailProvisionError && e.code === "not_configured"
        ? "provisioner_not_configured"
        : "provision_failed",
      detail,
    );
  }
  await Mailbox.updateOne(
    { _id: mailbox._id },
    { $set: { passwordCiphertext: encryptMailboxPassword(password) } },
  ).exec();
  await logMailbox(mailbox._id, actor.sub, "password.reset");
  await logEmployee(employeeId, actor.sub, "mailbox.password_reset");
  return done({ address: mailbox.address, password });
}

/**
 * Turn the mailbox's login off (or on) on the server by rotating its password
 * to one nobody holds; the app keeps reading it through the master user.
 */
export async function setMailboxDisabled(
  employeeId: string,
  disabled: boolean,
  actor: Actor,
): Promise<AccessResult<{ disabled: boolean }>> {
  const mailbox = await mailboxForEmployee(employeeId);
  if (!mailbox) return fail("not_found");
  if (!vaultConfigured()) return fail("vault_not_configured");
  const password = generateMailboxPassword();
  try {
    await getMailProvisioner().setPassword(mailbox.address, password);
  } catch (e) {
    const detail = e instanceof MailProvisionError ? e.message : String(e);
    return fail("provision_failed", detail);
  }
  await Mailbox.updateOne(
    { _id: mailbox._id },
    {
      $set: {
        status: disabled ? "disabled" : "active",
        passwordCiphertext: encryptMailboxPassword(password),
      },
    },
  ).exec();
  await logMailbox(mailbox._id, actor.sub, disabled ? "disabled" : "enabled");
  await logEmployee(
    employeeId,
    actor.sub,
    disabled ? "mailbox.disabled" : "mailbox.enabled",
  );
  return done({ disabled });
}
