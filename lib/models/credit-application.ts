import mongoose, { Schema, type Model } from "mongoose";
import type { CreditApplicationStatus } from "@/lib/schemas/credit";

export interface ICreditAppActivity {
  authorId: mongoose.Types.ObjectId | string;
  body: string;
  at: Date;
}

/**
 * A verification document uploaded with the application. `key` is a PRIVATE
 * storage key — served to admins only via the gated media route, never as a
 * public URL.
 */
export interface ICreditAppDocument {
  /** trade_license | tin_certificate | bin_certificate | bank_statement | national_id */
  label: string;
  key: string;
  filename: string;
  size?: number;
  mime?: string;
}

/**
 * "Apply for a credit facility" — an institution asking to buy on terms.
 * On approval an admin provisions a `CreditAccount`; no role is granted.
 */
export interface ICreditApplication {
  applicationNumber: string;
  userId: mongoose.Types.ObjectId | string;
  organization: string;
  contactName: string;
  email: string;
  phone?: string;
  address?: string;
  organizationType?: string;
  tradeLicenseNo?: string;
  tinNumber?: string;
  binNumber?: string;
  /** Rough monthly spend in poisha — helps size the facility. */
  expectedMonthlyVolumeMinor?: number | null;
  description: string;
  documents: ICreditAppDocument[];
  /** When the applicant accepted the credit terms (required to submit). */
  termsAcceptedAt?: Date | null;
  locale?: string;
  status: CreditApplicationStatus;
  assignedTo?: mongoose.Types.ObjectId | string | null;
  activity: ICreditAppActivity[];
  /** Set once the approval creates a CreditAccount (idempotency guard). */
  creditAccountId?: mongoose.Types.ObjectId | string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const creditApplicationSchema = new Schema<ICreditApplication>(
  {
    applicationNumber: { type: String, required: true, unique: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organization: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String },
    address: { type: String },
    organizationType: { type: String },
    tradeLicenseNo: { type: String },
    tinNumber: { type: String },
    binNumber: { type: String },
    expectedMonthlyVolumeMinor: { type: Number, default: null },
    description: { type: String, required: true },
    documents: {
      type: [
        new Schema<ICreditAppDocument>(
          {
            label: { type: String, required: true },
            key: { type: String, required: true },
            filename: { type: String, required: true },
            size: { type: Number },
            mime: { type: String },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    termsAcceptedAt: { type: Date, default: null },
    locale: { type: String },
    status: {
      type: String,
      enum: ["new", "reviewing", "approved", "rejected"],
      default: "new",
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    activity: {
      type: [
        new Schema<ICreditAppActivity>(
          {
            authorId: { type: Schema.Types.ObjectId, ref: "User" },
            body: String,
            at: Date,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    creditAccountId: {
      type: Schema.Types.ObjectId,
      ref: "CreditAccount",
      default: null,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "credit_applications", timestamps: true },
);

creditApplicationSchema.index({ status: 1, createdAt: -1 });

export const CreditApplication: Model<ICreditApplication> =
  (mongoose.models.CreditApplication as Model<ICreditApplication>) ??
  mongoose.model<ICreditApplication>(
    "CreditApplication",
    creditApplicationSchema,
  );
