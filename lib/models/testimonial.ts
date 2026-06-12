import mongoose, { Schema, type Model } from "mongoose";
import type { Tone } from "@/lib/content-types";

export type TestimonialCategory = "general" | "tourism";

export interface ITestimonial {
  quote: string;
  name: string;
  role: string;
  tone: Tone;
  /** Optional portrait photo (public URL/path), used by the carousel. */
  imageSrc?: string;
  /** Which surface this testimonial belongs to (homepage vs tourism hub). */
  category: TestimonialCategory;
  order: number;
  /** Visible on the public site when true; false hides without deleting. */
  published: boolean;
  deletedAt?: Date | null;
}

const testimonialSchema = new Schema<ITestimonial>(
  {
    quote: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: "" },
    tone: { type: String, default: "teal" },
    imageSrc: { type: String, default: "" },
    category: { type: String, default: "general", index: true },
    order: { type: Number, default: 0, index: true },
    published: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { collection: "testimonials", timestamps: true },
);

export const Testimonial: Model<ITestimonial> =
  (mongoose.models.Testimonial as Model<ITestimonial>) ??
  mongoose.model<ITestimonial>("Testimonial", testimonialSchema);
