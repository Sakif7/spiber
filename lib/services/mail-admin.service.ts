import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Mailbox, type IMailbox } from "@/lib/models/mailbox";
import { User } from "@/lib/models/user";
import type { Lean } from "@/lib/models/_shared";
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
import { vaultConfigured } from "@/lib/crypto/vault";
import { getMailProvisioner, MailProvisionError } from "@/lib/mail/provisioner";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import type { Actor } from "./hr/employee.service";

/**
 * Shared mailboxes (info@, sales@, career@ …): which addresses the company
 * opens together, and who may. Adding one creates the account on the mail
 * server when it does not exist yet — through the same provisioner the
 * employee mailboxes use, with a generated password kept encrypted for a
 * phone — and simply records it when it does (info@ from the old days).
 * The app reads it through the master user like any other mailbox.
 */

export type MailAdminError =
  | "invalid_address"
  | "exists"
  | "not_found"
  | "provisioner_not_configured"
  /** No COMPANY_VAULT_KEY: the new account's password could not be kept. */
  | "vault_not_configured"
  /** The mail server could not be reached or refused the account. */
  | "provision_failed"
  /** No password on record for this mailbox (recorded, not created, here). */
  | "no_password";

export type MailAdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: MailAdminError; detail?: string };

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

export async function listMailboxes(): Promise<Lean<IMailbox>[]> {
  await connectToDatabase();
  return Mailbox.find({ deletedAt: null })
    .sort({ kind: 1, address: 1 })
    .lean<Lean<IMailbox>[]>()
    .exec();
}

/** Everyone a shared mailbox can be assigned to: admins and employees. */
export async function listStaffUsers(): Promise<StaffUser[]> {
  await connectToDatabase();
  const rows = await User.find({
    roles: { $in: STAFF_ROLES },
    disabled: { $ne: true },
  })
    .select("_id name email roles")
    .sort({ name: 1 })
    .lean<{ _id: unknown; name?: string; email: string; roles: string[] }[]>()
    .exec();
  return rows.map((r) => ({
    id: String(r._id),
    name: r.name || r.email,
    email: r.email,
    roles: r.roles,
  }));
}

const provisionError = (e: unknown): MailAdminResult<never> => {
  if (e instanceof MailProvisionError && e.code === "not_configured") {
    return { ok: false, code: "provisioner_not_configured", detail: e.message };
  }
  return {
    ok: false,
    code: "provision_failed",
    detail: e instanceof Error ? e.message : String(e),
  };
};

export async function createSharedMailbox(
  local: string,
  actor: Actor,
): Promise<MailAdminResult<{ mailbox: Lean<IMailbox>; created: boolean }>> {
  const norm = normaliseLocalPart(local);
  if (!isValidLocalPart(norm)) return { ok: false, code: "invalid_address" };
  const address = businessAddress(norm, mailDomain());
  await connectToDatabase();
  if (await Mailbox.exists({ address, deletedAt: null })) {
    return { ok: false, code: "exists" };
  }
  let provisioner;
  try {
    provisioner = getMailProvisioner();
  } catch (e) {
    return provisionError(e);
  }
  // Already on the server (an address from before the app): record it. A
  // server that cannot be asked is an error now, not a guess — this action
  // creates accounts, so it must know.
  let onServer: boolean;
  try {
    onServer = Boolean(await provisioner.get(address));
  } catch (e) {
    return provisionError(e);
  }
  let password: string | null = null;
  if (!onServer) {
    if (!vaultConfigured()) return { ok: false, code: "vault_not_configured" };
    password = generateMailboxPassword();
    try {
      await provisioner.create({
        address,
        password,
        quota: quotaLabel(DEFAULT_MAILBOX_QUOTA_BYTES),
      });
    } catch (e) {
      if (e instanceof MailProvisionError && e.code === "exists") {
        // Appeared between the check and the create: treat it as existing.
        password = null;
      } else {
        return provisionError(e);
      }
    }
  }
  const created = password !== null;
  const doc = await Mailbox.create({
    address,
    kind: "shared",
    status: "active",
    assignedUserIds: [],
    ...(created
      ? {
          passwordCiphertext: encryptMailboxPassword(password as string),
          quotaBytes: DEFAULT_MAILBOX_QUOTA_BYTES,
          provider: provisioner.name,
          provisionedAt: new Date(),
          provisionedBy: actor.sub,
        }
      : { provider: null }),
    activity: [
      {
        at: new Date(),
        actorId: actor.sub,
        action: "shared.created",
        note: created
          ? "account created on the mail server"
          : "already on the mail server",
      },
    ],
  });
  return {
    ok: true,
    data: { mailbox: doc.toObject() as Lean<IMailbox>, created },
  };
}

async function sharedMailbox(
  mailboxId: string,
): Promise<Lean<IMailbox> | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(mailboxId)) return null;
  return Mailbox.findOne({ _id: mailboxId, deletedAt: null, kind: "shared" })
    .lean<Lean<IMailbox>>()
    .exec();
}

async function logMailbox(mailboxId: unknown, actorId: string, action: string) {
  await Mailbox.updateOne(
    { _id: mailboxId },
    {
      $push: {
        activity: {
          $each: [{ at: new Date(), actorId, action, note: null }],
          $slice: -200,
        },
      },
    },
  ).exec();
}

/** The mailbox's own password, for a phone or desktop client. Audited by the route. */
export async function revealSharedMailboxPassword(
  mailboxId: string,
  actor: Actor,
): Promise<MailAdminResult<{ address: string; password: string }>> {
  const mailbox = await sharedMailbox(mailboxId);
  if (!mailbox) return { ok: false, code: "not_found" };
  if (!mailbox.passwordCiphertext) return { ok: false, code: "no_password" };
  if (!vaultConfigured()) return { ok: false, code: "vault_not_configured" };
  const password = decryptMailboxPassword(mailbox.passwordCiphertext);
  await logMailbox(mailbox._id, actor.sub, "password.revealed");
  return { ok: true, data: { address: mailbox.address, password } };
}

/**
 * New random password on the server and in the vault (old clients drop
 * off). Also the way to take over an address recorded without one.
 */
export async function resetSharedMailboxPassword(
  mailboxId: string,
  actor: Actor,
): Promise<MailAdminResult<{ address: string; password: string }>> {
  const mailbox = await sharedMailbox(mailboxId);
  if (!mailbox) return { ok: false, code: "not_found" };
  if (!vaultConfigured()) return { ok: false, code: "vault_not_configured" };
  const password = generateMailboxPassword();
  try {
    await getMailProvisioner().setPassword(mailbox.address, password);
  } catch (e) {
    return provisionError(e);
  }
  await Mailbox.updateOne(
    { _id: mailbox._id },
    { $set: { passwordCiphertext: encryptMailboxPassword(password) } },
  ).exec();
  await logMailbox(mailbox._id, actor.sub, "password.reset");
  return { ok: true, data: { address: mailbox.address, password } };
}

export async function setAssignedUsers(
  mailboxId: string,
  userIds: string[],
  actor: Actor,
): Promise<MailAdminResult<Lean<IMailbox>>> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(mailboxId))
    return { ok: false, code: "not_found" };
  const staff = new Set((await listStaffUsers()).map((u) => u.id));
  const ids = [...new Set(userIds)].filter((id) => staff.has(id));
  const doc = await Mailbox.findOneAndUpdate(
    { _id: mailboxId, deletedAt: null, kind: "shared" },
    {
      $set: {
        assignedUserIds: ids.map((id) => new mongoose.Types.ObjectId(id)),
      },
      $push: {
        activity: {
          $each: [
            {
              at: new Date(),
              actorId: actor.sub,
              action: "shared.assigned",
              note: `${ids.length} user${ids.length === 1 ? "" : "s"}`,
            },
          ],
          $slice: -200,
        },
      },
    },
    { returnDocument: "after" },
  )
    .lean<Lean<IMailbox>>()
    .exec();
  return doc ? { ok: true, data: doc } : { ok: false, code: "not_found" };
}

export async function removeSharedMailbox(
  mailboxId: string,
  actor: Actor,
): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(mailboxId)) return false;
  const res = await Mailbox.updateOne(
    { _id: mailboxId, deletedAt: null, kind: "shared" },
    {
      $set: { deletedAt: new Date() },
      $push: {
        activity: {
          at: new Date(),
          actorId: actor.sub,
          action: "shared.removed",
          note: null,
        },
      },
    },
  ).exec();
  return res.matchedCount > 0;
}
