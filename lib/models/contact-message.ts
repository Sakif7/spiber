import mongoose, { Schema, type Model } from "mongoose";
import type { ContactInquiryType, ContactStatus } from "@/lib/schemas/contact";

/**
 * A submission from the website "Get in Touch" form. Soft-deletable and
 * timestamped, with a lightweight status pipeline for triage. Kept separate
 * from the `Inquiry` lead model (different shape + routing) and the legacy
 * `Quote` capture.
 */
export interface IContactMessage {
  contactNumber: string;
  name: string;
  email: string;
  phone: string;
  country?: string;
  inquiryType: ContactInquiryType;
  message: string;
  status: ContactStatus;
  locale?: string;
  meta?: { ip?: string; userAgent?: string };
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const contactMessageSchema = new Schema<IContactMessage>(
  {
    contactNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    country: { type: String, trim: true },
    inquiryType: {
      type: String,
      enum: ["sales", "support", "quotation", "partnership", "training"],
      required: true,
      index: true,
    },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["new", "read", "responded", "archived"],
      default: "new",
      index: true,
    },
    locale: { type: String },
    meta: {
      type: new Schema({ ip: String, userAgent: String }, { _id: false }),
      default: undefined,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "contact_messages", timestamps: true },
);

contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ createdAt: -1 });

export const ContactMessage: Model<IContactMessage> =
  (mongoose.models.ContactMessage as Model<IContactMessage>) ??
  mongoose.model<IContactMessage>("ContactMessage", contactMessageSchema);
