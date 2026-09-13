import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * A mailbox on the company mail server, and who may open it in the admin.
 *
 * The app reads and sends mail through ONE Dovecot master credential (env),
 * so this row never needs the mailbox's own password to open it. The password
 * is kept anyway — encrypted with the company vault key — because a phone or
 * desktop mail client cannot use the master user, and the super admin has to
 * be able to hand it over. Revealing it is audited.
 *
 * `personal`: one person's own address, created with their Employee record.
 * `shared`:   an address like info@ that several people may open; who may is
 *             the `assignedUserIds` list, set in Settings → Mail.
 */
export type MailboxKind = "personal" | "shared";
export type MailboxStatus =
  /** Row written, the mail server has not confirmed the account yet. */
  | "pending"
  | "active"
  /** Login refused on the server; mail still stored. */
  | "disabled"
  /** Provisioning failed; `lastError` says why, "Retry" tries again. */
  | "failed";

export interface IMailboxEvent {
  at: Date;
  actorId?: Types.ObjectId | string | null;
  action: string;
  note?: string | null;
}

export interface IMailbox {
  /** Full lower-case address, unique. */
  address: string;
  kind: MailboxKind;
  status: MailboxStatus;
  /** For a personal mailbox: the person it belongs to. */
  employeeId?: Types.ObjectId | string | null;
  /** For a personal mailbox: the login that owns it. */
  ownerUserId?: Types.ObjectId | string | null;
  /** For a shared mailbox: everyone allowed to open it. */
  assignedUserIds: (Types.ObjectId | string)[];
  /** Vault blob (see lib/crypto/vault) holding the mailbox's own password. */
  passwordCiphertext?: Buffer | null;
  quotaBytes?: number | null;
  /** Which provisioner created the account: "http" for the real server. */
  provider?: string | null;
  provisionedAt?: Date | null;
  provisionedBy?: Types.ObjectId | string | null;
  lastError?: string | null;
  activity: IMailboxEvent[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IMailboxEvent>(
  {
    at: { type: Date, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    note: { type: String, default: null },
  },
  { _id: false },
);

const mailboxSchema = new Schema<IMailbox>(
  {
    address: { type: String, required: true, lowercase: true, trim: true },
    kind: { type: String, enum: ["personal", "shared"], required: true },
    status: {
      type: String,
      enum: ["pending", "active", "disabled", "failed"],
      default: "pending",
    },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedUserIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    passwordCiphertext: { type: Buffer, default: null },
    quotaBytes: { type: Number, default: null, min: 0 },
    provider: { type: String, default: null },
    provisionedAt: { type: Date, default: null },
    provisionedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    lastError: { type: String, default: null },
    activity: { type: [eventSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { collection: "mailboxes", timestamps: true },
);

mailboxSchema.index(
  { address: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
mailboxSchema.index({ ownerUserId: 1, deletedAt: 1 });
mailboxSchema.index({ assignedUserIds: 1, deletedAt: 1 });
mailboxSchema.index({ employeeId: 1 });

export const Mailbox: Model<IMailbox> =
  (mongoose.models.Mailbox as Model<IMailbox>) ??
  mongoose.model<IMailbox>("Mailbox", mailboxSchema);
