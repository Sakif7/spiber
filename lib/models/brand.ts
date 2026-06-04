import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";

export interface IBrand {
  name: LocalizedDoc;
  slug: string;
  logo?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<IBrand>(
  {
    name: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    logo: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { collection: "brands", timestamps: true },
);

// Unique slug among non-deleted brands (soft-deleted rows free their slug).
brandSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

export const Brand: Model<IBrand> =
  (mongoose.models.Brand as Model<IBrand>) ??
  mongoose.model<IBrand>("Brand", brandSchema);
