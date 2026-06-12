import mongoose, { Schema, type Model } from "mongoose";
import type {
  PartnerApplicationStatus,
  PartnerType,
} from "@/lib/schemas/partner-application";

export interface IPartnerDocument {
  name: string;
  /** RAW PRIVATE STORAGE KEY — served only via the gated /api/media/partner route. */
  fileKey: string;
  contentType?: string;
  uploadedAt: Date;
}

export interface IPartnerActivity {
  authorId: mongoose.Types.ObjectId | string;
  body: string;
  at: Date;
}

export interface IPartnerApplication {
  partnerApplicationNumber: string;
  type: PartnerType;
  orgInfo: {
    name: string;
    website?: string;
    country?: string;
    description?: string;
  };
  contact: { name: string; email: string; phone: string };
  documents: IPartnerDocument[];
  status: PartnerApplicationStatus;
  assignedTo?: mongoose.Types.ObjectId | string | null;
  activity: IPartnerActivity[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const partnerApplicationSchema = new Schema<IPartnerApplication>(
  {
    partnerApplicationNumber: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["hospital", "doctor", "agency", "diagnostic", "insurance"],
      required: true,
      index: true,
    },
    orgInfo: {
      name: { type: String, required: true, trim: true },
      website: { type: String },
      country: { type: String },
      description: { type: String },
    },
    contact: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
    },
    documents: {
      type: [
        new Schema<IPartnerDocument>(
          {
            name: { type: String, required: true },
            fileKey: { type: String, required: true },
            contentType: { type: String },
            uploadedAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
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
        new Schema<IPartnerActivity>(
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
    deletedAt: { type: Date, default: null },
  },
  { collection: "tourism_partner_applications", timestamps: true },
);

partnerApplicationSchema.index({ status: 1, createdAt: -1 });
partnerApplicationSchema.index({ type: 1, status: 1, createdAt: -1 });

export const PartnerApplication: Model<IPartnerApplication> =
  (mongoose.models.PartnerApplication as Model<IPartnerApplication>) ??
  mongoose.model<IPartnerApplication>(
    "PartnerApplication",
    partnerApplicationSchema,
  );
