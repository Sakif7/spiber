import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Order, type IOrder } from "@/lib/models/order";
import type { Lean } from "@/lib/models/_shared";
import type { OrderStatus } from "@/lib/schemas/order";

type OrderFilter = NonNullable<Parameters<typeof Order.countDocuments>[0]>;

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

export type OrderListParams = {
  status?: OrderStatus;
  /** Filter the admin list to one storefront (Medtrade vs Spiber Kart). */
  storefront?: "instruments" | "marketplace";
  search?: string;
  page?: number;
  pageSize?: number;
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
  if (params.search) {
    q.$or = [
      { orderNumber: { $regex: params.search, $options: "i" } },
      { email: { $regex: params.search, $options: "i" } },
    ];
  }
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const filter = q as unknown as OrderFilter;
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IOrder>[]>()
      .exec(),
    Order.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
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
