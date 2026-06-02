import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product, type IProduct } from "@/lib/models/product";
import type { Lean } from "@/lib/models/_shared";
import {
  findCart,
  deleteCart,
  type CartOwner,
} from "@/lib/repositories/cart.repo";
import {
  createOrder,
  getOrderById,
  getOrderByIdempotencyKey,
} from "@/lib/repositories/orders.repo";
import { incrementCouponUsage } from "@/lib/repositories/coupons.repo";
import { applyMovement, InsufficientStockError } from "./inventory.service";
import { priceCart, type PricingCoupon } from "./pricing.service";
import { getShippingSettings } from "./shop-settings.service";
import { validateCoupon } from "./coupon.service";
import { getPaymentProvider } from "@/lib/payments";
import { getMailer } from "@/lib/mailer";
import { siteConfig } from "@/lib/site-config";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";
import {
  ORDER_TRANSITIONS,
  type CheckoutInput,
  type OrderStatus,
} from "@/lib/schemas/order";
import type { IOrder, IOrderItem } from "@/lib/models/order";

function genOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `SPM-${ts}-${rand}`;
}

export type PlaceOrderResult =
  | { ok: true; order: IOrder }
  | { ok: false; code: "empty_cart" | "out_of_stock" | "product_unavailable" };

/**
 * Place an order from the owner's cart. Idempotent on `idempotencyKey`.
 * Stock is decremented at placement via atomic conditional updates (saga); a
 * failure compensates already-decremented items and aborts. No multi-document
 * transaction required (works on standalone Mongo).
 */
export async function placeOrder(
  input: CheckoutInput,
  owner: CartOwner,
  userId?: string,
): Promise<PlaceOrderResult> {
  await connectToDatabase();

  const existing = await getOrderByIdempotencyKey(input.idempotencyKey);
  if (existing) return { ok: true, order: existing.toObject() };

  const cart = await findCart(owner);
  if (!cart || cart.items.length === 0)
    return { ok: false, code: "empty_cart" };

  // Resolve products + current prices.
  const ids = cart.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } })
    .lean<Lean<IProduct>[]>()
    .exec();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines: { product: Lean<IProduct>; qty: number; priceMinor: number }[] =
    [];
  for (const it of cart.items) {
    const p = byId.get(String(it.productId));
    if (!p || p.status !== "active" || p.deletedAt) {
      return { ok: false, code: "product_unavailable" };
    }
    lines.push({ product: p, qty: it.qty, priceMinor: p.priceMinor });
  }

  // Totals (pure) — computed before any stock change.
  const subtotalMinor = lines.reduce((s, l) => s + l.priceMinor * l.qty, 0);
  let pricingCoupon: PricingCoupon = null;
  let couponId: string | undefined;
  let couponCode: string | undefined;
  if (input.couponCode) {
    const v = await validateCoupon(input.couponCode, subtotalMinor);
    if (v.ok) {
      pricingCoupon = {
        type: v.coupon.type,
        value: v.coupon.value,
        minSubtotalMinor: v.coupon.minSubtotalMinor,
      };
      couponId = v.coupon.id;
      couponCode = v.coupon.code;
    }
  }
  const shipping = await getShippingSettings();
  const totals = priceCart(
    lines.map((l) => ({ priceMinor: l.priceMinor, qty: l.qty })),
    pricingCoupon,
    shipping,
  );

  // Pre-generate the order id so stock movements can reference it.
  const orderId = new mongoose.Types.ObjectId();

  // Saga: decrement stock; compensate on any failure.
  const decremented: { productId: string; qty: number }[] = [];
  try {
    for (const l of lines) {
      await applyMovement({
        productId: String(l.product._id),
        type: "sale",
        qtyDelta: -l.qty,
        refOrderId: String(orderId),
        createdBy: userId,
        reason: "order",
      });
      decremented.push({ productId: String(l.product._id), qty: l.qty });
    }
  } catch (err) {
    await compensate(decremented, String(orderId));
    if (err instanceof InsufficientStockError)
      return { ok: false, code: "out_of_stock" };
    throw err;
  }

  const items: IOrderItem[] = lines.map((l) => ({
    productId: l.product._id as unknown as mongoose.Types.ObjectId,
    productSnapshot: {
      name: l.product.name,
      sku: l.product.sku,
      priceMinor: l.priceMinor,
      image: l.product.images[0],
    },
    qty: l.qty,
    lineTotalMinor: l.priceMinor * l.qty,
  }));

  const now = new Date();
  let order;
  try {
    order = await createOrder({
      _id: orderId,
      orderNumber: genOrderNumber(),
      userId: userId ? new mongoose.Types.ObjectId(userId) : null,
      email: input.email,
      items,
      subtotalMinor: totals.subtotalMinor,
      shippingMinor: totals.shippingMinor,
      taxMinor: totals.taxMinor,
      discountMinor: totals.discountMinor,
      totalMinor: totals.totalMinor,
      currency: "BDT",
      status: "pending",
      payment: { provider: getPaymentProvider().name, status: "unpaid" },
      shippingAddress: input.shippingAddress,
      couponCode,
      note: input.note,
      idempotencyKey: input.idempotencyKey,
      timeline: [{ status: "pending", at: now, note: "Order placed" }],
    } as Partial<IOrder>);
  } catch (err: unknown) {
    // Duplicate idempotency key (concurrent retry): undo this attempt's stock, return existing.
    if (isDuplicateKey(err)) {
      await compensate(decremented, String(orderId));
      const dup = await getOrderByIdempotencyKey(input.idempotencyKey);
      if (dup) return { ok: true, order: dup.toObject() };
    }
    await compensate(decremented, String(orderId));
    throw err;
  }

  if (couponId) await incrementCouponUsage(couponId).catch(() => {});
  await deleteCart(owner).catch(() => {});
  await sendOrderEmail(order, "placed").catch((e) =>
    logger.warn("order confirmation email failed", e),
  );

  return { ok: true, order: order.toObject() };
}

async function compensate(
  decremented: { productId: string; qty: number }[],
  orderId: string,
) {
  for (const d of decremented) {
    await applyMovement({
      productId: d.productId,
      type: "return",
      qtyDelta: d.qty,
      refOrderId: orderId,
      reason: "order_rollback",
    }).catch((e) => logger.error("stock compensation failed", e));
  }
}

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

// ---- Lifecycle transitions ----

export type TransitionResult =
  | { ok: true; order: IOrder }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  opts: { note?: string; trackingNumber?: string } = {},
): Promise<TransitionResult> {
  const order = await getOrderById(orderId);
  if (!order) return { ok: false, code: "not_found" };
  if (!ORDER_TRANSITIONS[order.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }

  const now = new Date();

  if (to === "paid") {
    order.payment.status = "paid";
    order.payment.paidAt = now;
  }

  // Cancelling or refunding restores the stock taken at placement.
  if (to === "cancelled" || to === "refunded") {
    for (const it of order.items) {
      await applyMovement({
        productId: String(it.productId),
        type: "return",
        qtyDelta: it.qty,
        refOrderId: String(order._id),
        reason: to,
      }).catch((e) => logger.error("restock on " + to + " failed", e));
    }
    if (to === "refunded") order.payment.status = "refunded";
  }

  if (opts.trackingNumber) order.trackingNumber = opts.trackingNumber;
  order.status = to;
  order.timeline.push({ status: to, at: now, note: opts.note });
  await order.save();

  if (to === "paid" || to === "shipped") {
    await sendOrderEmail(order, to).catch((e) =>
      logger.warn("order status email failed", e),
    );
  }
  return { ok: true, order: order.toObject() };
}

async function sendOrderEmail(
  order: IOrder,
  event: "placed" | "paid" | "shipped",
) {
  const subjectMap: Record<typeof event, string> = {
    placed: `Order ${order.orderNumber} received`,
    paid: `Payment confirmed for ${order.orderNumber}`,
    shipped: `Your order ${order.orderNumber} has shipped`,
  };
  const lines = order.items
    .map((i) => `- ${i.productSnapshot.name.en} ×${i.qty}`)
    .join("\n");
  const tracking =
    event === "shipped" && order.trackingNumber
      ? `\nTracking: ${order.trackingNumber}`
      : "";
  await getMailer().send({
    to: order.email,
    subject: subjectMap[event],
    text: `${subjectMap[event]}\n\n${lines}\n\nTotal: ${formatBDT(order.totalMinor)}${tracking}\n\n${siteConfig.brand}`,
    html: `<p>${subjectMap[event]}</p><ul>${order.items
      .map((i) => `<li>${i.productSnapshot.name.en} ×${i.qty}</li>`)
      .join(
        "",
      )}</ul><p><strong>Total: ${formatBDT(order.totalMinor)}</strong>${tracking ? `<br/>${tracking}` : ""}</p>`,
  });
}
