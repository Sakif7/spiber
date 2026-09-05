import { connectToDatabase } from "@/lib/db/connect";
import {
  SoftwareProduct,
  type ISoftwareProduct,
} from "@/lib/models/softwareProduct";
import type { Lean } from "@/lib/models/_shared";
import type { SoftwareStatus } from "@/lib/schemas/systems";
import { applyPartialSearch } from "@/lib/repositories/search-filter";
import { applyDateRange, sortSpec, type RepoListQuery } from "./list-query";

type SoftwareFilter = NonNullable<
  Parameters<typeof SoftwareProduct.countDocuments>[0]
>;

/** Sort keys the admin software list exposes → stored fields. */
const SOFTWARE_SORT: Record<string, string> = {
  date: "createdAt",
  name: "name.en",
  price: "priceMinor",
  status: "status",
};

export type SoftwareListParams = RepoListQuery & {
  status?: SoftwareStatus;
  /** Admin filters (validated against the enums by the page). */
  pricingModel?: string;
  deliveryType?: string;
};

export async function listSoftwareProducts(params: SoftwareListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.pricingModel) q.pricingModel = params.pricingModel;
  if (params.deliveryType) q.deliveryType = params.deliveryType;
  applyPartialSearch(q, params.search, [
    "name.en",
    "name.bn",
    "description.en",
    "description.bn",
  ]);
  applyDateRange(q, params.from, params.to);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, params.pageSize ?? 12));
  const filter = q as unknown as SoftwareFilter;
  const [items, total] = await Promise.all([
    SoftwareProduct.find(filter)
      .sort(
        params.sort
          ? sortSpec(params.sort, params.dir, SOFTWARE_SORT)
          : { createdAt: -1 },
      )
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
  unset: string[] = [],
) {
  await connectToDatabase();
  const update: Record<string, unknown> = { $set: data };
  if (unset.length) {
    update.$unset = Object.fromEntries(unset.map((k) => [k, ""]));
  }
  // Guard `deletedAt: null` so a soft-deleted product can't be silently edited.
  return SoftwareProduct.findOneAndUpdate(
    { _id: id, deletedAt: null },
    update,
    {
      new: true,
    },
  ).exec();
}

/** "More solutions" rail — other active software (same category preferred). */
export async function listRelatedSoftware(
  productId: string,
  opts: { categoryId?: string | null; limit?: number } = {},
) {
  await connectToDatabase();
  const limit = opts.limit ?? 3;
  const base = {
    status: "active",
    deletedAt: null,
    _id: { $ne: productId },
  } as unknown as SoftwareFilter;
  const out: Lean<ISoftwareProduct>[] = [];
  if (opts.categoryId) {
    const sameCat = await SoftwareProduct.find({
      ...base,
      categoryId: opts.categoryId,
    } as unknown as SoftwareFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<Lean<ISoftwareProduct>[]>()
      .exec();
    out.push(...sameCat);
  }
  if (out.length < limit) {
    const seen = new Set(out.map((p) => String(p._id)));
    const fill = await SoftwareProduct.find(base)
      .sort({ createdAt: -1 })
      .limit(limit + out.length)
      .lean<Lean<ISoftwareProduct>[]>()
      .exec();
    for (const p of fill) {
      if (out.length >= limit) break;
      if (!seen.has(String(p._id))) out.push(p);
    }
  }
  return out.slice(0, limit);
}

export async function softDeleteSoftwareProduct(id: string) {
  await connectToDatabase();
  await SoftwareProduct.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date(), status: "archived" } },
  ).exec();
}
