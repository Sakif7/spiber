import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";

export interface ICategory {
  name: LocalizedDoc;
  slug: string;
  parentId?: mongoose.Types.ObjectId | string | null;
  image?: string;
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
    deletedAt: { type: Date, default: null },
  },
  { collection: "categories", timestamps: true },
);

// Unique slug among non-deleted categories (soft-deleted rows free their slug).
categorySchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

export const Category: Model<ICategory> =
  (mongoose.models.Category as Model<ICategory>) ??
  mongoose.model<ICategory>("Category", categorySchema);
