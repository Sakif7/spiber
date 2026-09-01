import mongoose, { Schema, type Model } from "mongoose";

export type CreditAccountStatus = "active" | "suspended";

/** Default net terms granted on approval, in days. */
export const DEFAULT_CREDIT_TERMS_DAYS = 30;

/**
 * An "enlisted" institutional buyer (hospital, clinic, distributor) who may
 * order on Medtrade against a credit account instead of paying up front: the
 * order ships, and the invoice falls due `termsDays` later.
 *
 * Deliberately NOT a role. Eligibility is checked against this collection at
 * checkout (`getActiveCreditAccount`), so approving or suspending an account
 * takes effect immediately — no re-login, no stale JWT claim.
 *
 * v1 tracks terms only: there is no credit limit or outstanding-balance ledger.
 * Each order carries its own `payment.dueAt`, and admins collect against it.
 */
export interface ICreditAccount {
  userId: mongoose.Types.ObjectId | string;
  /** Legal/trading name the invoice is billed to. */
  organization: string;
  /** Net payment terms in days (e.g. 30 = "Net 30"). */
  termsDays: number;
  status: CreditAccountStatus;
  /** Admin-only remarks (credit history, contacts, agreed limits, …). */
  notes?: string;
  /** The application this account was provisioned from, when there was one. */
  applicationId?: mongoose.Types.ObjectId | string | null;
  approvedBy?: mongoose.Types.ObjectId | string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const creditAccountSchema = new Schema<ICreditAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organization: { type: String, required: true, trim: true },
    termsDays: {
      type: Number,
      required: true,
      default: DEFAULT_CREDIT_TERMS_DAYS,
      min: 1,
      max: 365,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    notes: { type: String },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "CreditApplication",
      default: null,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
  },
  { collection: "credit_accounts", timestamps: true },
);

// One LIVE account per user. Partial on `deletedAt: null` so a soft-deleted
// account frees the slot for a fresh one (mirrors the Seller model).
creditAccountSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
creditAccountSchema.index({ createdAt: -1 });

export const CreditAccount: Model<ICreditAccount> =
  (mongoose.models.CreditAccount as Model<ICreditAccount>) ??
  mongoose.model<ICreditAccount>("CreditAccount", creditAccountSchema);
