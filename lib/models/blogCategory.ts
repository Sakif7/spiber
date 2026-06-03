import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";

export interface IBlogCategory {
  name: LocalizedDoc;
  slug: string;
  description?: LocalizedDoc;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const blogCategorySchema = new Schema<IBlogCategory>(
  {
    name: { ...localizedDef },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { en: { type: String }, bn: { type: String } },
    deletedAt: { type: Date, default: null },
  },
  { collection: "blog_categories", timestamps: true },
);

export const BlogCategory: Model<IBlogCategory> =
  (mongoose.models.BlogCategory as Model<IBlogCategory>) ??
  mongoose.model<IBlogCategory>("BlogCategory", blogCategorySchema);
