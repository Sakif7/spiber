import { connectToDatabase } from "@/lib/db/connect";
import { Brand, type IBrand } from "@/lib/models/brand";
import { Category, type ICategory } from "@/lib/models/category";
import type { Lean } from "@/lib/models/_shared";

// ---- Brands ----
export async function listBrands() {
  await connectToDatabase();
  return Brand.find({ deletedAt: null })
    .sort({ "name.en": 1 })
    .lean<Lean<IBrand>[]>()
    .exec();
}
export async function getBrandBySlug(slug: string) {
  await connectToDatabase();
  return Brand.findOne({ slug, deletedAt: null }).lean<Lean<IBrand>>().exec();
}
export async function getBrandById(id: string) {
  await connectToDatabase();
  return Brand.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IBrand>>()
    .exec();
}
export async function createBrand(data: Partial<IBrand>) {
  await connectToDatabase();
  return Brand.create(data);
}
export async function updateBrand(id: string, data: Partial<IBrand>) {
  await connectToDatabase();
  return Brand.findByIdAndUpdate(id, data, { new: true }).exec();
}
export async function softDeleteBrand(id: string) {
  await connectToDatabase();
  await Brand.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date() } },
  ).exec();
}

// ---- Categories ----
export async function listCategories() {
  await connectToDatabase();
  return Category.find({ deletedAt: null })
    .sort({ "name.en": 1 })
    .lean<Lean<ICategory>[]>()
    .exec();
}
export async function getCategoryBySlug(slug: string) {
  await connectToDatabase();
  return Category.findOne({ slug, deletedAt: null })
    .lean<Lean<ICategory>>()
    .exec();
}
export async function createCategory(data: Partial<ICategory>) {
  await connectToDatabase();
  return Category.create(data);
}
export async function updateCategory(id: string, data: Partial<ICategory>) {
  await connectToDatabase();
  return Category.findByIdAndUpdate(id, data, { new: true }).exec();
}
export async function softDeleteCategory(id: string) {
  await connectToDatabase();
  await Category.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date() } },
  ).exec();
}
