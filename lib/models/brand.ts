import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";

export interface IBrand {
  name: LocalizedDoc;
  slug: string;
  logo?: string;
  /** Manual sort order — lower shows first (in admin lists, filters, and the
   * "By brand" nav cascade). Ties fall back to name. */
  position: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<IBrand>(
  {
    name: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    logo: { type: String },
    position: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { collection: "brands", timestamps: true },
);

// Unique slug among non-deleted brands (soft-deleted rows free their slug).
brandSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
// Ordered brand reads.
brandSchema.index({ position: 1, "name.en": 1 });

export const Brand: Model<IBrand> =
  (mongoose.models.Brand as Model<IBrand>) ??
  mongoose.model<IBrand>("Brand", brandSchema);
