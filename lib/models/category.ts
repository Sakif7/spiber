import mongoose, { Schema, type Model } from "mongoose";
import {
  localizedDef,
  localizedOptionalDef,
  type LocalizedDoc,
} from "./_shared";
import type { Storefront } from "@/lib/schemas/catalog";

export interface ICategory {
  name: LocalizedDoc;
  slug: string;
  parentId?: mongoose.Types.ObjectId | string | null;
  image?: string;
  storefront: Storefront;
  description?: LocalizedDoc;
  position: number;
  featured: boolean;
  icon?: string;
  /**
   * Per-category seller commission (basis points). null → inherit from the
   * parent category, then the platform default. Admin-set (Sellers → Settings).
   */
  sellerCommissionBp?: number | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    image: { type: String },
    storefront: {
      type: String,
      enum: ["instruments", "marketplace"],
      required: true,
      default: "marketplace",
      index: true,
    },
    description: { ...localizedOptionalDef },
    position: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    icon: { type: String },
    sellerCommissionBp: { type: Number, default: null, min: 0, max: 10000 },
    deletedAt: { type: Date, default: null },
  },
  { collection: "categories", timestamps: true },
);

// Unique slug among non-deleted categories (soft-deleted rows free their slug).
categorySchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
// Ordered tree reads within a storefront.
categorySchema.index({ storefront: 1, parentId: 1, position: 1 });

export const Category: Model<ICategory> =
  (mongoose.models.Category as Model<ICategory>) ??
  mongoose.model<ICategory>("Category", categorySchema);
