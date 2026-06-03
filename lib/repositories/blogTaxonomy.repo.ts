import { connectToDatabase } from "@/lib/db/connect";
import { BlogCategory, type IBlogCategory } from "@/lib/models/blogCategory";
import { BlogTag, type IBlogTag } from "@/lib/models/blogTag";
import type { Lean } from "@/lib/models/_shared";

// ---- Categories ----
export async function listBlogCategories() {
  await connectToDatabase();
  return BlogCategory.find({ deletedAt: null })
    .sort({ "name.en": 1 })
    .lean<Lean<IBlogCategory>[]>()
    .exec();
}
export async function getBlogCategoryBySlug(slug: string) {
  await connectToDatabase();
  return BlogCategory.findOne({ slug, deletedAt: null })
    .lean<Lean<IBlogCategory>>()
    .exec();
}
export async function createBlogCategory(data: Partial<IBlogCategory>) {
  await connectToDatabase();
  return BlogCategory.create(data);
}
export async function updateBlogCategory(
  id: string,
  data: Partial<IBlogCategory>,
) {
  await connectToDatabase();
  return BlogCategory.findByIdAndUpdate(id, data, { new: true }).exec();
}
export async function softDeleteBlogCategory(id: string) {
  await connectToDatabase();
  await BlogCategory.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date() } },
  ).exec();
}

// ---- Tags ----
export async function listBlogTags() {
  await connectToDatabase();
  return BlogTag.find({ deletedAt: null })
    .sort({ "name.en": 1 })
    .lean<Lean<IBlogTag>[]>()
    .exec();
}
export async function getBlogTagBySlug(slug: string) {
  await connectToDatabase();
  return BlogTag.findOne({ slug, deletedAt: null })
    .lean<Lean<IBlogTag>>()
    .exec();
}
export async function getBlogTagsByIds(ids: (string | object)[]) {
  await connectToDatabase();
  if (!ids.length) return [];
  return BlogTag.find({ _id: { $in: ids }, deletedAt: null })
    .lean<Lean<IBlogTag>[]>()
    .exec();
}
export async function createBlogTag(data: Partial<IBlogTag>) {
  await connectToDatabase();
  return BlogTag.create(data);
}
export async function updateBlogTag(id: string, data: Partial<IBlogTag>) {
  await connectToDatabase();
  return BlogTag.findByIdAndUpdate(id, data, { new: true }).exec();
}
export async function softDeleteBlogTag(id: string) {
  await connectToDatabase();
  await BlogTag.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date() } },
  ).exec();
}
