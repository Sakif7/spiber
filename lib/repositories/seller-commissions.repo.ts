import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  SellerCommission,
  type ISellerCommission,
} from "@/lib/models/seller-commission";
import type { Lean } from "@/lib/models/_shared";
import type { SellerCommissionStatus } from "@/lib/schemas/seller-commission";

type Filter = NonNullable<
  Parameters<typeof SellerCommission.countDocuments>[0]
>;

/** Create a commission; returns null on a duplicate (idempotent per order+seller). */
export async function createSellerCommission(data: Partial<ISellerCommission>) {
  await connectToDatabase();
  try {
    return await SellerCommission.create(data);
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) return null;
    throw err;
  }
}

export async function listSellerCommissions(
  params: {
    sellerId?: string;
    status?: SellerCommissionStatus;
    payoutId?: string | null;
  } = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.sellerId) q.sellerId = params.sellerId;
  if (params.status) q.status = params.status;
  if (params.payoutId !== undefined) q.payoutId = params.payoutId;
  return SellerCommission.find(q as unknown as Filter)
    .sort({ createdAt: -1 })
    .lean<Lean<ISellerCommission>[]>()
    .exec();
}

export async function getCommissionsByIds(ids: string[]) {
  await connectToDatabase();
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return [];
  return SellerCommission.find({ _id: { $in: valid }, deletedAt: null })
    .lean<Lean<ISellerCommission>[]>()
    .exec();
}

/** Commissions available to pay out for a seller (accrued + not yet in a payout). */
export async function availableCommissionsForSeller(sellerId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(sellerId)) return [];
  return SellerCommission.find({
    sellerId,
    status: "accrued",
    payoutId: null,
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .lean<Lean<ISellerCommission>[]>()
    .exec();
}

export async function linkCommissionsToPayout(ids: string[], payoutId: string) {
  await connectToDatabase();
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return 0;
  const res = await SellerCommission.updateMany(
    { _id: { $in: valid }, status: "accrued", payoutId: null },
    { $set: { payoutId: new mongoose.Types.ObjectId(payoutId) } },
  ).exec();
  return res.modifiedCount ?? 0;
}

export async function markCommissionsPaidByPayout(payoutId: string) {
  await connectToDatabase();
  const res = await SellerCommission.updateMany(
    { payoutId, status: "accrued" },
    { $set: { status: "paid", paidAt: new Date() } },
  ).exec();
  return res.modifiedCount ?? 0;
}

export async function voidAccruedByOrder(orderId: string) {
  await connectToDatabase();
  const res = await SellerCommission.updateMany(
    { orderId, status: "accrued", payoutId: null },
    { $set: { status: "void" } },
  ).exec();
  return res.modifiedCount ?? 0;
}

/** Accrued-and-unpaid earnings grouped by seller (for the admin payout view). */
export async function availableEarningsBySeller(): Promise<
  { sellerId: string; totalEarningsMinor: number; count: number }[]
> {
  await connectToDatabase();
  const rows = await SellerCommission.aggregate<{
    _id: mongoose.Types.ObjectId;
    totalEarningsMinor: number;
    count: number;
  }>([
    { $match: { status: "accrued", payoutId: null, deletedAt: null } },
    {
      $group: {
        _id: "$sellerId",
        totalEarningsMinor: { $sum: "$sellerEarningsMinor" },
        count: { $sum: 1 },
      },
    },
  ]).exec();
  return rows.map((r) => ({
    sellerId: String(r._id),
    totalEarningsMinor: r.totalEarningsMinor,
    count: r.count,
  }));
}

/** Daily earnings series for the seller dashboard chart (last `days` days,
 * accrued + paid; voided rows excluded). Zero-filled by the caller. */
export async function sellerEarningsSeries(
  sellerId: string,
  days = 30,
  now = new Date(),
): Promise<{ day: string; earningsMinor: number; orders: number }[]> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(sellerId)) return [];
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await SellerCommission.aggregate<{
    _id: string;
    earningsMinor: number;
    orders: number;
  }>([
    {
      $match: {
        sellerId: new mongoose.Types.ObjectId(sellerId),
        status: { $in: ["accrued", "paid"] },
        accruedAt: { $gte: since },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$accruedAt" } },
        earningsMinor: { $sum: "$sellerEarningsMinor" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).exec();
  return rows.map((r) => ({
    day: r._id,
    earningsMinor: r.earningsMinor,
    orders: r.orders,
  }));
}

/** This seller's commission rows for a set of orders (net-earnings display on
 * the seller orders page). Keyed by order id by the caller. */
export async function sellerCommissionsByOrderIds(
  sellerId: string,
  orderIds: string[],
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(sellerId)) return [];
  const valid = orderIds.filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return [];
  return SellerCommission.find({
    sellerId,
    orderId: { $in: valid },
    deletedAt: null,
  })
    .lean<Lean<ISellerCommission>[]>()
    .exec();
}

/** Lifetime earnings summary for a seller's dashboard. */
export async function sellerEarningsSummary(sellerId: string): Promise<{
  accruedMinor: number;
  paidMinor: number;
}> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(sellerId))
    return { accruedMinor: 0, paidMinor: 0 };
  const rows = await SellerCommission.aggregate<{
    _id: string;
    total: number;
  }>([
    {
      $match: {
        sellerId: new mongoose.Types.ObjectId(sellerId),
        status: { $in: ["accrued", "paid"] },
        deletedAt: null,
      },
    },
    { $group: { _id: "$status", total: { $sum: "$sellerEarningsMinor" } } },
  ]).exec();
  const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.total]));
  return {
    accruedMinor: byStatus.accrued ?? 0,
    paidMinor: byStatus.paid ?? 0,
  };
}
