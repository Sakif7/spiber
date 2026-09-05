import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Order, type IOrder } from "@/lib/models/order";
import type { Lean } from "@/lib/models/_shared";
import type { OrderStatus } from "@/lib/schemas/order";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

export async function createOrder(data: Partial<IOrder>) {
  await connectToDatabase();
  return Order.create(data);
}

export async function getOrderById(id: string) {
  await connectToDatabase();
  return Order.findById(id).exec();
}

export async function getOrderByNumber(orderNumber: string) {
  await connectToDatabase();
  return Order.findOne({ orderNumber }).exec();
}

export async function getOrderByIdempotencyKey(key: string) {
  await connectToDatabase();
  return Order.findOne({ idempotencyKey: key }).exec();
}

export async function findOrderForGuest(orderNumber: string, email: string) {
  await connectToDatabase();
  return Order.findOne({ orderNumber, email: email.trim().toLowerCase() })
    .lean<Lean<IOrder>>()
    .exec();
}

export async function listOrdersByUser(userId: string) {
  await connectToDatabase();
  return Order.find({ userId })
    .sort({ createdAt: -1 })
    .lean<Lean<IOrder>[]>()
    .exec();
}

/** Sort keys the admin orders list exposes → stored fields. */
const ORDER_SORT: Record<string, string> = {
  date: "createdAt",
  number: "orderNumber",
  email: "email",
  status: "status",
  total: "totalMinor",
};

export type OrderListParams = RepoListQuery & {
  status?: OrderStatus;
  /** Filter the admin list to one storefront (Medtrade vs Spiber Kart). */
  storefront?: "instruments" | "marketplace";
};

export async function listOrders(params: OrderListParams) {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.status) q.status = params.status;
  if (params.storefront) {
    // `null` in `$in` also matches docs missing the field, so any order that
    // predates the storefront column still counts as a marketplace order.
    q.storefront =
      params.storefront === "marketplace"
        ? { $in: ["marketplace", null] }
        : params.storefront;
  }
  // Escaped, per-term substring match (the old raw $regex let "(" break the query).
  applyPartialSearch(q, params.search, ["orderNumber", "email"]);
  applyDateRange(q, params.from, params.to);
  return paginate<IOrder>(Order, q, {
    sort: sortSpec(params.sort, params.dir, ORDER_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 20,
  });
}

/** Dashboard KPIs: today's paid revenue + counts. `dayStart` passed in (no Date.now in shared code paths). */
export async function revenueSince(dayStart: Date) {
  await connectToDatabase();
  const [agg] = await Order.aggregate([
    {
      $match: {
        "payment.status": "paid",
        "payment.paidAt": { $gte: dayStart },
        // Defensive: a paid order that was later cancelled/refunded must never
        // count as revenue (transitionOrder also flips payment.status, but this
        // guards any legacy rows written before that fix).
        status: { $nin: ["cancelled", "refunded"] },
      },
    },
    {
      $group: {
        _id: null,
        totalMinor: { $sum: "$totalMinor" },
        count: { $sum: 1 },
      },
    },
  ]);
  return { revenueMinor: agg?.totalMinor ?? 0, count: agg?.count ?? 0 };
}

export async function countOrdersByStatus(status: OrderStatus) {
  await connectToDatabase();
  return Order.countDocuments({ status });
}

/** Orders containing at least one item owned by this seller (seller portal). */
export async function listOrdersForSeller(sellerId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(sellerId)) return [];
  return Order.find({ "items.productSnapshot.sellerId": sellerId })
    .sort({ createdAt: -1 })
    .lean<Lean<IOrder>[]>()
    .exec();
}

export async function countOrdersForSeller(sellerId: string): Promise<number> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(sellerId)) return 0;
  return Order.countDocuments({ "items.productSnapshot.sellerId": sellerId });
}

/** Order numbers for a set of order ids (stock-ledger references). */
export async function orderNumbersByIds(
  ids: string[],
): Promise<Record<string, string>> {
  await connectToDatabase();
  const valid = [...new Set(ids)].filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return {};
  const rows = await Order.find({ _id: { $in: valid } })
    .select("_id orderNumber")
    .lean<{ _id: mongoose.Types.ObjectId; orderNumber: string }[]>()
    .exec();
  return Object.fromEntries(rows.map((r) => [String(r._id), r.orderNumber]));
}
