import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { BlogStatus } from "@/lib/schemas/blog";

export interface IBlogSeo {
  metaTitle?: LocalizedDoc;
  metaDescription?: LocalizedDoc;
  ogImage?: string;
}

export interface IBlogPost {
  title: LocalizedDoc;
  slug: string;
  excerpt?: LocalizedDoc;
  /** Localized HTML (sanitized on save). */
  body: LocalizedDoc;
  coverImage?: string;
  authorId: mongoose.Types.ObjectId | string;
  categoryId?: mongoose.Types.ObjectId | string | null;
  tagIds: (mongoose.Types.ObjectId | string)[];
  status: BlogStatus;
  publishedAt?: Date | null;
  scheduledFor?: Date | null;
  readingTimeMin?: number;
  seo?: IBlogSeo;
  viewCount: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const optionalLocalized = { en: { type: String }, bn: { type: String } };

const blogPostSchema = new Schema<IBlogPost>(
  {
    title: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    excerpt: optionalLocalized,
    body: { ...localizedDef },
    coverImage: { type: String },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "BlogCategory",
      default: null,
      index: true,
    },
    tagIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "BlogTag" }],
      default: [],
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "archived"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date, default: null },
    scheduledFor: { type: Date, default: null },
    readingTimeMin: { type: Number },
    seo: {
      metaTitle: optionalLocalized,
      metaDescription: optionalLocalized,
      ogImage: { type: String },
    },
    viewCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { collection: "blog_posts", timestamps: true },
);

// Unique slug among non-deleted posts (soft-deleted rows free their slug).
blogPostSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
// Visibility + ordering: status published/scheduled with publishedAt ≤ now.
blogPostSchema.index({ status: 1, publishedAt: -1 });
// Search across localized titles + excerpts.
blogPostSchema.index({
  "title.en": "text",
  "title.bn": "text",
  "excerpt.en": "text",
  "excerpt.bn": "text",
});

export const BlogPost: Model<IBlogPost> =
  (mongoose.models.BlogPost as Model<IBlogPost>) ??
  mongoose.model<IBlogPost>("BlogPost", blogPostSchema);
