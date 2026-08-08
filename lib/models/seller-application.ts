import mongoose, { Schema, type Model } from "mongoose";
import type { IBankDetails } from "./seller";
import type { SellerApplicationStatus } from "@/lib/schemas/seller-application";

export interface ISellerAppActivity {
  authorId: mongoose.Types.ObjectId | string;
  body: string;
  at: Date;
}

/** A KYC/verification document uploaded with the application. The `key` is a
 * PRIVATE storage key — served to admins only via the gated media route. */
export interface ISellerAppDocument {
  /** Document kind: trade_license | national_id | tin_certificate | bank_statement */
  label: string;
  key: string;
  filename: string;
  size?: number;
  mime?: string;
}

export interface ISellerApplication {
  applicationNumber: string;
  userId: mongoose.Types.ObjectId | string;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string;
  categories?: string;
  description: string;
  bankDetails?: IBankDetails;
  /** KYC documents (trade license, NID, …) — private storage keys. */
  documents: ISellerAppDocument[];
  /** When the applicant accepted the seller terms (required to submit). */
  termsAcceptedAt?: Date | null;
  locale?: string;
  status: SellerApplicationStatus;
  assignedTo?: mongoose.Types.ObjectId | string | null;
  activity: ISellerAppActivity[];
  /** Set once the approval creates a Seller (idempotency guard). */
  sellerId?: mongoose.Types.ObjectId | string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bankDetailsSchema = new Schema<IBankDetails>(
  {
    accountName: String,
    bankName: String,
    accountNumber: String,
    branch: String,
    routingNumber: String,
    mobileWallet: String,
  },
  { _id: false },
);

const sellerApplicationSchema = new Schema<ISellerApplication>(
  {
    applicationNumber: { type: String, required: true, unique: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    businessName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String },
    website: { type: String },
    address: { type: String },
    categories: { type: String },
    description: { type: String, required: true },
    bankDetails: { type: bankDetailsSchema, default: undefined },
    documents: {
      type: [
        new Schema<ISellerAppDocument>(
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
        new Schema<ISellerAppActivity>(
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
    sellerId: { type: Schema.Types.ObjectId, ref: "Seller", default: null },
    deletedAt: { type: Date, default: null },
  },
  { collection: "seller_applications", timestamps: true },
);

sellerApplicationSchema.index({ status: 1, createdAt: -1 });

export const SellerApplication: Model<ISellerApplication> =
  (mongoose.models.SellerApplication as Model<ISellerApplication>) ??
  mongoose.model<ISellerApplication>(
    "SellerApplication",
    sellerApplicationSchema,
  );
