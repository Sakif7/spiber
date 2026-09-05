import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Seller, type ISeller } from "@/lib/models/seller";
import type { Lean } from "@/lib/models/_shared";
import type { SellerStatus } from "@/lib/schemas/seller";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type SellerFilter = NonNullable<Parameters<typeof Seller.countDocuments>[0]>;

export async function createSeller(data: Partial<ISeller>) {
  await connectToDatabase();
  return Seller.create(data);
}

export async function getSellerByUserId(userId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(userId)) return null;
  return Seller.findOne({ userId, deletedAt: null })
    .lean<Lean<ISeller>>()
    .exec();
}

export async function getSellerById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Seller.findOne({ _id: id, deletedAt: null })
    .lean<Lean<ISeller>>()
    .exec();
}

export async function getSellerBySlug(slug: string) {
  await connectToDatabase();
  return Seller.findOne({ slug, deletedAt: null }).lean<Lean<ISeller>>().exec();
}

export async function listSellers(params: { status?: SellerStatus } = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  return Seller.find(q as unknown as SellerFilter)
    .sort({ createdAt: -1 })
    .lean<Lean<ISeller>[]>()
    .exec();
}

/** Sort keys the admin list exposes → stored fields. */
const SELLER_SORT: Record<string, string> = {
  date: "createdAt",
  name: "displayName",
  status: "status",
};

export type SellerAdminListParams = RepoListQuery & {
  status?: SellerStatus;
};

/** Searchable, sortable, paged list for the admin (list kit). */
export async function listSellersForAdmin(params: SellerAdminListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  applyPartialSearch(q, params.search, ["displayName", "slug"]);
  applyDateRange(q, params.from, params.to);
  return paginate<ISeller>(Seller, q, {
    sort: sortSpec(params.sort, params.dir, SELLER_SORT),
    page: params.page,
    pageSize: params.pageSize,
  });
}

export async function listActiveSellers() {
  await connectToDatabase();
  return Seller.find({ deletedAt: null, status: "active" })
    .sort({ displayName: 1 })
    .lean<Lean<ISeller>[]>()
    .exec();
}

export async function updateSeller(id: string, data: Partial<ISeller>) {
  await connectToDatabase();
  return Seller.findOneAndUpdate({ _id: id, deletedAt: null }, data, {
    new: true,
  })
    .lean<Lean<ISeller>>()
    .exec();
}

/** Update the seller owned by `userId` (seller-portal profile edits). */
export async function updateSellerByUserId(
  userId: string,
  data: Partial<ISeller>,
) {
  await connectToDatabase();
  return Seller.findOneAndUpdate({ userId, deletedAt: null }, data, {
    new: true,
  })
    .lean<Lean<ISeller>>()
    .exec();
}

export async function setSellerStatus(id: string, status: SellerStatus) {
  await connectToDatabase();
  return Seller.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { status },
    { new: true },
  )
    .lean<Lean<ISeller>>()
    .exec();
}

export async function countSellers(): Promise<number> {
  await connectToDatabase();
  return Seller.countDocuments({ deletedAt: null } as unknown as SellerFilter);
}

/** Map of sellerId → displayName for tables/badges. */
export async function sellerNamesByIds(
  ids: string[],
): Promise<Record<string, string>> {
  await connectToDatabase();
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return {};
  const rows = await Seller.find({ _id: { $in: valid } })
    .select("_id displayName")
    .lean<{ _id: mongoose.Types.ObjectId; displayName: string }[]>()
    .exec();
  return Object.fromEntries(rows.map((r) => [String(r._id), r.displayName]));
}
