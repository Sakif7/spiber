import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";

export interface IBlogTag {
  name: LocalizedDoc;
  slug: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const blogTagSchema = new Schema<IBlogTag>(
  {
    name: { ...localizedDef },
    slug: { type: String, required: true, unique: true, trim: true },
    deletedAt: { type: Date, default: null },
  },
  { collection: "blog_tags", timestamps: true },
);

export const BlogTag: Model<IBlogTag> =
  (mongoose.models.BlogTag as Model<IBlogTag>) ??
  mongoose.model<IBlogTag>("BlogTag", blogTagSchema);
