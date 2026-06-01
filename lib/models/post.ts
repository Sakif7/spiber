import mongoose, { Schema, type Model } from "mongoose";
import type { Tone } from "@/lib/content-types";

/**
 * Landing-page "Latest news" card. This is the lightweight display shape used
 * by the marketing home; the full bilingual BlogPost model lands in Phase 6.
 */
export interface IPost {
  kicker: string;
  title: string;
  excerpt: string;
  date: string;
  read: string;
  tone: Tone;
  placeholder: string;
}

const postSchema = new Schema<IPost>(
  {
    kicker: { type: String, default: "" },
    title: { type: String, required: true },
    excerpt: { type: String, default: "" },
    date: { type: String, default: "", index: true },
    read: { type: String, default: "" },
    tone: { type: String, default: "teal" },
    placeholder: { type: String, default: "" },
  },
  { collection: "posts" },
);

export const Post: Model<IPost> =
  (mongoose.models.Post as Model<IPost>) ??
  mongoose.model<IPost>("Post", postSchema);
