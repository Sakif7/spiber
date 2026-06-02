import { connectToDatabase } from "@/lib/db/connect";
import {
  SoftwarePurchase,
  type ISoftwarePurchase,
} from "@/lib/models/softwarePurchase";
import type { Lean } from "@/lib/models/_shared";
import type { PurchaseStatus } from "@/lib/schemas/systems";

type PurchaseFilter = NonNullable<
  Parameters<typeof SoftwarePurchase.countDocuments>[0]
>;

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

export type PurchaseListParams = {
  status?: PurchaseStatus;
  page?: number;
  pageSize?: number;
};

export async function listPurchases(params: PurchaseListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.status) q.status = params.status;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const filter = q as unknown as PurchaseFilter;
  const [items, total] = await Promise.all([
    SoftwarePurchase.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<ISoftwarePurchase>[]>()
      .exec(),
    SoftwarePurchase.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function createPurchase(data: Partial<ISoftwarePurchase>) {
  await connectToDatabase();
  return SoftwarePurchase.create(data);
}
