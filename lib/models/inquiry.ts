import mongoose, { Schema, type Model } from "mongoose";
import type { InquiryDivision, InquiryStatus } from "@/lib/schemas/inquiry";

export interface IInquiryNote {
  authorId: mongoose.Types.ObjectId | string;
  body: string;
  at: Date;
}
export interface IInquiryAttachment {
  name: string;
  fileKey: string;
}
export interface IInquiryLinkedEntity {
  kind: "software" | "package" | "service";
  id: string;
}

export interface IInquiry {
  inquiryNumber: string;
  division: InquiryDivision;
  subject?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  budgetRange?: string;
  linkedEntity?: IInquiryLinkedEntity | null;
  payload?: Record<string, unknown>;
  status: InquiryStatus;
  assignedTo?: mongoose.Types.ObjectId | string | null;
  notes: IInquiryNote[];
  attachments: IInquiryAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

const inquirySchema = new Schema<IInquiry>(
  {
    inquiryNumber: { type: String, required: true, unique: true },
    division: {
      type: String,
      enum: ["systems", "tourism", "consulting"],
      required: true,
      index: true,
    },
    subject: { type: String },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String },
    company: { type: String },
    message: { type: String, required: true },
    budgetRange: { type: String },
    linkedEntity: {
      type: new Schema<IInquiryLinkedEntity>(
        { kind: String, id: String },
        { _id: false },
      ),
      default: null,
    },
    payload: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ["new", "qualifying", "proposal", "won", "lost"],
      default: "new",
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    notes: {
      type: [
        new Schema<IInquiryNote>(
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
      type: [
        new Schema<IInquiryAttachment>(
          { name: String, fileKey: String },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { collection: "inquiries", timestamps: true },
);

inquirySchema.index({ division: 1, status: 1, createdAt: -1 });

export const Inquiry: Model<IInquiry> =
  (mongoose.models.Inquiry as Model<IInquiry>) ??
  mongoose.model<IInquiry>("Inquiry", inquirySchema);
