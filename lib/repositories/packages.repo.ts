import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  TreatmentPackage,
  type ITreatmentPackage,
} from "@/lib/models/treatmentPackage";
import type { Lean } from "@/lib/models/_shared";
import { applyPartialSearch } from "./search-filter";
import type {
  TourismStatus,
  TreatmentCategory,
} from "@/lib/schemas/tourism-catalog";

type Filter = NonNullable<
  Parameters<typeof TreatmentPackage.countDocuments>[0]
>;

export async function createPackage(data: Partial<ITreatmentPackage>) {
  await connectToDatabase();
  return TreatmentPackage.create(data);
}

export async function getPackageByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return TreatmentPackage.findOne({ _id: id, deletedAt: null })
    .lean<Lean<ITreatmentPackage>>()
    .exec();
}

export async function getActivePackageBySlug(slug: string) {
  await connectToDatabase();
  return TreatmentPackage.findOne({ slug, status: "active", deletedAt: null })
    .lean<Lean<ITreatmentPackage>>()
    .exec();
}

export type PackageListParams = {
  status?: TourismStatus;
  search?: string;
  category?: TreatmentCategory;
  page?: number;
  pageSize?: number;
};

export async function listPackages(params: PackageListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.category) q.category = params.category;
  applyPartialSearch(q, params.search, [
    "name.en",
    "name.bn",
    "description.en",
    "description.bn",
  ]);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 24));
  const filter = q as unknown as Filter;
  const [items, total] = await Promise.all([
    TreatmentPackage.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<ITreatmentPackage>[]>()
      .exec(),
    TreatmentPackage.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listActivePackagesForFeed(limit = 100) {
  await connectToDatabase();
  return TreatmentPackage.find({ status: "active", deletedAt: null })
    .select("slug updatedAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Lean<ITreatmentPackage>[]>()
    .exec();
}

export async function updatePackage(
  id: string,
  patch: Partial<ITreatmentPackage>,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return TreatmentPackage.findOneAndUpdate(
    { _id: id, deletedAt: null },
    patch,
    {
      new: true,
    },
  )
    .lean<Lean<ITreatmentPackage>>()
    .exec();
}

export async function softDeletePackage(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return TreatmentPackage.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  )
    .lean<Lean<ITreatmentPackage>>()
    .exec();
}
