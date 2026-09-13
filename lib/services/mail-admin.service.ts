import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Mailbox, type IMailbox } from "@/lib/models/mailbox";
import { User } from "@/lib/models/user";
import type { Lean } from "@/lib/models/_shared";
import {
  businessAddress,
  isValidLocalPart,
  normaliseLocalPart,
} from "@/lib/mail/address";
import { mailDomain } from "@/lib/mail/config";
import { getMailProvisioner, MailProvisionError } from "@/lib/mail/provisioner";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import type { Actor } from "./hr/employee.service";

/**
 * Shared mailboxes (info@, sales@ …): which addresses the company opens
 * together, and who may. A shared mailbox is never created on the server
 * from here — it must already exist (created by hand on the mail server or
 * left over from the old provider); this only records it and who sees it.
 * The app reads it through the master user like any other mailbox.
 */

export type MailAdminError =
  | "invalid_address"
  | "exists"
  /** No account with that address on the mail server. */
  | "not_on_server"
  | "not_found"
  | "provisioner_not_configured";

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

export async function createSharedMailbox(
  local: string,
  actor: Actor,
): Promise<MailAdminResult<Lean<IMailbox>>> {
  const norm = normaliseLocalPart(local);
  if (!isValidLocalPart(norm)) return { ok: false, code: "invalid_address" };
  const address = businessAddress(norm, mailDomain());
  await connectToDatabase();
  if (await Mailbox.exists({ address, deletedAt: null })) {
    return { ok: false, code: "exists" };
  }
  try {
    const onServer = await getMailProvisioner().get(address);
    if (!onServer) return { ok: false, code: "not_on_server" };
  } catch (e) {
    if (e instanceof MailProvisionError && e.code === "not_configured") {
      return {
        ok: false,
        code: "provisioner_not_configured",
        detail: e.message,
      };
    }
    // Server unreachable: record it anyway; opening it will say if it is wrong.
  }
  const doc = await Mailbox.create({
    address,
    kind: "shared",
    status: "active",
    assignedUserIds: [],
    provider: null,
    activity: [
      {
        at: new Date(),
        actorId: actor.sub,
        action: "shared.created",
        note: null,
      },
    ],
  });
  return { ok: true, data: doc.toObject() as Lean<IMailbox> };
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
