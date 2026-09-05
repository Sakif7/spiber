import { connectToDatabase } from "@/lib/db/connect";
import {
  SoftwarePurchase,
  type ISoftwarePurchase,
} from "@/lib/models/softwarePurchase";
import type { Lean } from "@/lib/models/_shared";
import type { PurchaseStatus } from "@/lib/schemas/systems";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

export async function getPurchaseByIdempotencyKey(key: string) {
  await connectToDatabase();
  return SoftwarePurchase.findOne({ idempotencyKey: key }).exec();
}

export async function getPurchaseById(id: string) {
  await connectToDatabase();
  return SoftwarePurchase.findById(id).exec();
}

export async function getPurchaseByNumber(purchaseNumber: string) {
  await connectToDatabase();
  return SoftwarePurchase.findOne({ purchaseNumber })
    .lean<Lean<ISoftwarePurchase>>()
    .exec();
}

/** A user's existing (non-final) purchase of a product, if any — resume vs. duplicate. */
export async function getOpenPurchase(
  userId: string,
  softwareProductId: string,
) {
  await connectToDatabase();
  return SoftwarePurchase.findOne({
    userId,
    softwareProductId,
    status: { $in: ["pending", "paid"] },
  }).exec();
}

/** True when the user owns a PAID purchase of the product (secure-asset gate). */
export async function hasPaidPurchase(
  userId: string,
  softwareProductId: string,
): Promise<boolean> {
  await connectToDatabase();
  const p = await SoftwarePurchase.findOne({
    userId,
    softwareProductId,
    status: "paid",
  })
    .select("_id")
    .lean()
    .exec();
  return Boolean(p);
}

export async function listPurchasesByUser(userId: string) {
  await connectToDatabase();
  return SoftwarePurchase.find({ userId })
    .sort({ createdAt: -1 })
    .lean<Lean<ISoftwarePurchase>[]>()
    .exec();
}

/** Sort keys the admin purchases list exposes → stored fields. */
const PURCHASE_SORT: Record<string, string> = {
  date: "createdAt",
  number: "purchaseNumber",
  email: "email",
  status: "status",
  total: "totalMinor",
};

export type PurchaseListParams = RepoListQuery & {
  status?: PurchaseStatus;
};

export async function listPurchases(params: PurchaseListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.status) q.status = params.status;
  applyPartialSearch(q, params.search, [
    "purchaseNumber",
    "email",
    "productSnapshot.name.en",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<ISoftwarePurchase>(SoftwarePurchase, q, {
    sort: sortSpec(params.sort, params.dir, PURCHASE_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
  });
}

export async function createPurchase(data: Partial<ISoftwarePurchase>) {
  await connectToDatabase();
  return SoftwarePurchase.create(data);
}
