import { connectToDatabase } from "@/lib/db/connect";
import {
  SoftwareProduct,
  type ISoftwareProduct,
} from "@/lib/models/softwareProduct";
import type { Lean } from "@/lib/models/_shared";
import type { SoftwareStatus } from "@/lib/schemas/systems";
import { applyPartialSearch } from "@/lib/repositories/search-filter";

type SoftwareFilter = NonNullable<
  Parameters<typeof SoftwareProduct.countDocuments>[0]
>;

export type SoftwareListParams = {
  status?: SoftwareStatus;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listSoftwareProducts(params: SoftwareListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  applyPartialSearch(q, params.search, [
    "name.en",
    "name.bn",
    "description.en",
    "description.bn",
  ]);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, params.pageSize ?? 12));
  const filter = q as unknown as SoftwareFilter;
  const [items, total] = await Promise.all([
    SoftwareProduct.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<ISoftwareProduct>[]>()
      .exec(),
    SoftwareProduct.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getSoftwareProductBySlug(slug: string) {
  await connectToDatabase();
  return SoftwareProduct.findOne({ slug, deletedAt: null })
    .lean<Lean<ISoftwareProduct>>()
    .exec();
}

export async function getSoftwareProductByIdLean(id: string) {
  await connectToDatabase();
  return SoftwareProduct.findOne({ _id: id, deletedAt: null })
    .lean<Lean<ISoftwareProduct>>()
    .exec();
}

export async function getSoftwareProductById(id: string) {
  await connectToDatabase();
  return SoftwareProduct.findOne({ _id: id, deletedAt: null }).exec();
}

export async function createSoftwareProduct(data: Partial<ISoftwareProduct>) {
  await connectToDatabase();
  return SoftwareProduct.create(data);
}

export async function updateSoftwareProduct(
  id: string,
  data: Partial<ISoftwareProduct>,
) {
  await connectToDatabase();
  return SoftwareProduct.findByIdAndUpdate(id, data, { new: true }).exec();
}

export async function softDeleteSoftwareProduct(id: string) {
  await connectToDatabase();
  await SoftwareProduct.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date(), status: "archived" } },
  ).exec();
}
