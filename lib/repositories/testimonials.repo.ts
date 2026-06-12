import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Testimonial, type ITestimonial } from "@/lib/models/testimonial";
import type { Lean } from "@/lib/models/_shared";
import type {
  TestimonialCreateInput,
  TestimonialUpdateInput,
} from "@/lib/schemas/testimonial";

/** Admin read/write access for testimonials (includes `_id`, ignores published). */

export async function listTestimonialsForAdmin(): Promise<
  Lean<ITestimonial>[]
> {
  await connectToDatabase();
  return Testimonial.find({ deletedAt: null })
    .sort({ category: 1, order: 1, createdAt: 1 })
    .lean<Lean<ITestimonial>[]>()
    .exec();
}

export async function getTestimonialById(
  id: string,
): Promise<Lean<ITestimonial> | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;
  return Testimonial.findOne({ _id: id, deletedAt: null })
    .lean<Lean<ITestimonial>>()
    .exec();
}

export async function createTestimonial(input: TestimonialCreateInput) {
  await connectToDatabase();
  return Testimonial.create(input);
}

export async function updateTestimonial(
  id: string,
  patch: TestimonialUpdateInput,
) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;
  return Testimonial.findOneAndUpdate({ _id: id, deletedAt: null }, patch, {
    new: true,
  }).exec();
}

export async function softDeleteTestimonial(id: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;
  return Testimonial.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  ).exec();
}
