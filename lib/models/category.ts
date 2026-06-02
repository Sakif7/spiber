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
    slug: { type: String, required: true, unique: true, trim: true },
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

export const Category: Model<ICategory> =
  (mongoose.models.Category as Model<ICategory>) ??
  mongoose.model<ICategory>("Category", categorySchema);
