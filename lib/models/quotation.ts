import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { QuotationStatus } from "@/lib/schemas/quotation";

export interface IQuotationItem {
  productId: mongoose.Types.ObjectId | string;
  variantId?: string | null;
  productSnapshot: {
    name: LocalizedDoc;
    sku: string;
    slug: string;
    image?: string;
    variantOptions?: { name: string; value: string }[];
  };
  quantity: number;
}

export interface IQuotationQuote {
  amountMinor?: number | null;
  validUntil?: Date | null;
  fileKey?: string | null;
  note?: string | null;
}

export interface IQuotationNote {
  authorId: mongoose.Types.ObjectId | string;
  body: string;
  at: Date;
}

export interface IQuotation {
  quotationNumber: string;
  requesterId?: mongoose.Types.ObjectId | string | null;
  contact: {
    name: string;
    email: string;
    organization?: string;
    phone?: string;
  };
  items: IQuotationItem[];
  deliveryLocation: { district: string; city?: string };
  timeline?: string;
  notes?: string;
  status: QuotationStatus;
  quote?: IQuotationQuote | null;
  assignedTo?: mongoose.Types.ObjectId | string | null;
  activity: IQuotationNote[];
  attachments: { name: string; fileKey: string }[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const quotationItemSchema = new Schema<IQuotationItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: String, default: null },
    productSnapshot: {
      name: { ...localizedDef },
      sku: { type: String, required: true },
      slug: { type: String, required: true },
      image: { type: String },
      variantOptions: {
        type: [
          new Schema(
            { name: { type: String }, value: { type: String } },
            { _id: false },
          ),
        ],
        default: [],
      },
    },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const quotationSchema = new Schema<IQuotation>(
  {
    quotationNumber: { type: String, required: true, unique: true },
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    contact: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      organization: { type: String },
      phone: { type: String },
    },
    items: { type: [quotationItemSchema], required: true },
    deliveryLocation: {
      district: { type: String, required: true },
      city: { type: String },
    },
    timeline: { type: String },
    notes: { type: String },
    status: {
      type: String,
      enum: ["new", "quoted", "negotiating", "won", "lost"],
      default: "new",
      index: true,
    },
    quote: {
      type: new Schema<IQuotationQuote>(
        {
          amountMinor: { type: Number, default: null },
          validUntil: { type: Date, default: null },
          fileKey: { type: String, default: null },
          note: { type: String, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    activity: {
      type: [
        new Schema<IQuotationNote>(
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
    attachments: {
      type: [new Schema({ name: String, fileKey: String }, { _id: false })],
      default: [],
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "quotation_requests", timestamps: true },
);

quotationSchema.index({ status: 1, createdAt: -1 });
quotationSchema.index({ requesterId: 1, createdAt: -1 });

export const Quotation: Model<IQuotation> =
  (mongoose.models.Quotation as Model<IQuotation>) ??
  mongoose.model<IQuotation>("Quotation", quotationSchema);
