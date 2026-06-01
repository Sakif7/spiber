import mongoose, { Schema, type Model } from "mongoose";
import type { Tone } from "@/lib/content-types";

export interface ITestimonial {
  quote: string;
  name: string;
  role: string;
  tone: Tone;
  order: number;
}

const testimonialSchema = new Schema<ITestimonial>(
  {
    quote: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: "" },
    tone: { type: String, default: "teal" },
    order: { type: Number, default: 0, index: true },
  },
  { collection: "testimonials", timestamps: true },
);

export const Testimonial: Model<ITestimonial> =
  (mongoose.models.Testimonial as Model<ITestimonial>) ??
  mongoose.model<ITestimonial>("Testimonial", testimonialSchema);
