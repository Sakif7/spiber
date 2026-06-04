import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  Product,
  type IProduct,
  type IProductVariant,
} from "@/lib/models/product";
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
import {
  reserveCouponUsage,
  releaseCouponUsage,
  releaseCouponUsageByCode,
} from "@/lib/repositories/coupons.repo";
import { makeId } from "@/lib/ids";
import { applyMovement, InsufficientStockError } from "./inventory.service";
import { priceCart, type PricingCoupon } from "./pricing.service";
import { getShippingSettings } from "./shop-settings.service";
import { validateCoupon } from "./coupon.service";
import { getPaymentProvider } from "@/lib/payments";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";
import {
  ORDER_TRANSITIONS,
  type CheckoutInput,
  type OrderStatus,
} from "@/lib/schemas/order";
import type { IOrder, IOrderItem } from "@/lib/models/order";

const genOrderNumber = (): string => makeId("SPM");

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
  storefront: "instruments" | "marketplace" = "marketplace",
): Promise<PlaceOrderResult> {
  await connectToDatabase();

  const existing = await getOrderByIdempotencyKey(input.idempotencyKey);
  if (existing) return { ok: true, order: existing.toObject() };

  const cart = await findCart(owner);
  if (!cart || cart.items.length === 0)
    return { ok: false, code: "empty_cart" };

  // Resolve products + current prices (re-resolved server-side; the cart's
  // price snapshot is display-only and never trusted for charging).
  const ids = cart.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } })
    .lean<Lean<IProduct>[]>()
    .exec();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines: {
    product: Lean<IProduct>;
    variantId: string | null;
    variant?: IProductVariant;
    qty: number;
    priceMinor: number;
  }[] = [];
  for (const it of cart.items) {
    const p = byId.get(String(it.productId));
    if (!p || p.status !== "active" || p.deletedAt) {
      return { ok: false, code: "product_unavailable" };
    }
    const variantId = it.variantId ?? null;
    let variant: IProductVariant | undefined;
    let unitPrice: number | null;
    if (variantId) {
      variant = p.variants?.find((v) => v.id === variantId);
      if (!variant) return { ok: false, code: "product_unavailable" };
      unitPrice = variant.priceMinorOverride ?? p.priceMinor;
    } else {
      unitPrice = p.priceMinor;
    }
    // A buyable product must resolve a concrete price.
    if (unitPrice == null) return { ok: false, code: "product_unavailable" };
    lines.push({
      product: p,
      variantId,
      variant,
      qty: it.qty,
      priceMinor: unitPrice,
    });
  }

  // Totals (pure) — computed before any stock change.
  const subtotalMinor = lines.reduce((s, l) => s + l.priceMinor * l.qty, 0);
  let pricingCoupon: PricingCoupon = null;
  let couponId: string | undefined;
  let couponCode: string | undefined;
  if (input.couponCode) {
    const v = await validateCoupon(
      input.couponCode,
      subtotalMinor,
      new Date(),
      storefront,
    );
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
  let totals = priceCart(
    lines.map((l) => ({ priceMinor: l.priceMinor, qty: l.qty })),
    pricingCoupon,
    shipping,
  );

  // Pre-generate the order id so stock movements can reference it.
  const orderId = new mongoose.Types.ObjectId();

  // Saga: decrement stock; compensate on any failure.
  const decremented: {
    productId: string;
    variantId: string | null;
    qty: number;
  }[] = [];
  try {
    for (const l of lines) {
      await applyMovement({
        productId: String(l.product._id),
        variantId: l.variantId,
        type: "sale",
        qtyDelta: -l.qty,
        refOrderId: String(orderId),
        createdBy: userId,
        reason: "order",
      });
      decremented.push({
        productId: String(l.product._id),
        variantId: l.variantId,
        qty: l.qty,
      });
    }
  } catch (err) {
    await compensate(decremented, String(orderId));
    if (err instanceof InsufficientStockError)
      return { ok: false, code: "out_of_stock" };
    throw err;
  }

  // Atomically claim the coupon's redemption slot BEFORE committing the order,
  // so two concurrent checkouts can't both redeem a usage-limited coupon. If it
  // was exhausted in the race, drop the discount and re-price at full amount.
  let couponReserved = false;
  if (couponId) {
    couponReserved = await reserveCouponUsage(couponId);
    if (!couponReserved) {
      logger.warn(
        `coupon ${couponCode} exhausted at placement; dropping discount`,
      );
      pricingCoupon = null;
      couponId = undefined;
      couponCode = undefined;
      totals = priceCart(
        lines.map((l) => ({ priceMinor: l.priceMinor, qty: l.qty })),
        null,
        shipping,
      );
    }
  }

  const items: IOrderItem[] = lines.map((l) => ({
    productId: l.product._id as unknown as mongoose.Types.ObjectId,
    productSnapshot: {
      name: l.product.name,
      sku: l.variant?.sku ?? l.product.sku,
      priceMinor: l.priceMinor,
      image: l.variant?.image ?? l.product.images[0],
      variantId: l.variantId,
      variantOptions: l.variant?.options ?? [],
    },
    qty: l.qty,
    lineTotalMinor: l.priceMinor * l.qty,
  }));

  const now = new Date();
  // Create the order, retrying ONLY an orderNumber collision (regenerate the
  // number, keep the already-decremented stock). Any other unique-key failure
  // is treated as a concurrent same-idempotency-key placement.
  const MAX_ORDER_TRIES = 5;
  let createdOrder: Awaited<ReturnType<typeof createOrder>> | null = null;
  for (let attempt = 1; attempt <= MAX_ORDER_TRIES; attempt++) {
    try {
      createdOrder = await createOrder({
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
        storefront,
        idempotencyKey: input.idempotencyKey,
        timeline: [{ status: "pending", at: now, note: "Order placed" }],
      } as Partial<IOrder>);
      break;
    } catch (err: unknown) {
      const field = duplicateKeyField(err);
      if (field === "orderNumber" && attempt < MAX_ORDER_TRIES) continue;
      // Roll back this attempt's side effects EXACTLY ONCE.
      await compensate(decremented, String(orderId));
      if (couponReserved && couponId)
        await releaseCouponUsage(couponId).catch(() => {});
      if (field) {
        // Concurrent placement with the same idempotency key won the race.
        const dup = await getOrderByIdempotencyKey(input.idempotencyKey);
        if (dup) return { ok: true, order: dup.toObject() };
      }
      throw err;
    }
  }
  if (!createdOrder) throw new Error("order creation failed after retries");
  const order = createdOrder;

  await deleteCart(owner).catch(() => {});
  await sendOrderEmail(order, "placed").catch((e) =>
    logger.warn("order confirmation email failed", e),
  );

  return { ok: true, order: order.toObject() };
}

async function compensate(
  decremented: { productId: string; variantId: string | null; qty: number }[],
  orderId: string,
) {
  for (const d of decremented) {
    await applyMovement({
      productId: d.productId,
      variantId: d.variantId,
      type: "return",
      qtyDelta: d.qty,
      refOrderId: orderId,
      reason: "order_rollback",
    }).catch((e) => logger.error("stock compensation failed", e));
  }
}

/**
 * For a Mongo duplicate-key (11000) error, the name of the unique field that
 * collided (e.g. "orderNumber" or "idempotencyKey"); null if it isn't a 11000.
 * Lets the caller retry an orderNumber collision while treating an
 * idempotencyKey collision as a concurrent duplicate placement.
 */
function duplicateKeyField(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  if (e.code !== 11000) return null;
  const keys = e.keyPattern ? Object.keys(e.keyPattern) : [];
  return keys[0] ?? "unknown";
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
        variantId: it.productSnapshot.variantId ?? null,
        type: "return",
        qtyDelta: it.qty,
        refOrderId: String(order._id),
        reason: to,
      }).catch((e) => logger.error("restock on " + to + " failed", e));
    }
    // A paid order that is cancelled is effectively a refund — reconcile payment
    // so it stops counting as revenue (cancelled/refunded are terminal, so this
    // runs at most once per order).
    if (to === "refunded" || order.payment.status === "paid") {
      order.payment.status = "refunded";
      order.payment.refundedAt = now;
    }
    // Return the coupon's redemption slot.
    if (order.couponCode) {
      await releaseCouponUsageByCode(order.couponCode).catch((e) =>
        logger.warn("coupon release failed", e),
      );
    }
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
  const eyebrowMap: Record<typeof event, string> = {
    placed: "Order received",
    paid: "Payment confirmed",
    shipped: "On its way",
  };
  const headingMap: Record<typeof event, string> = {
    placed: "Thanks — your order is in",
    paid: "Your payment is confirmed",
    shipped: "Your order has shipped",
  };
  const introMap: Record<typeof event, string> = {
    placed:
      "We've received your order and will confirm your offline payment shortly. Here's a summary for your records.",
    paid: "Your payment has been confirmed — we're now preparing your order for shipment.",
    shipped: "Good news — your order is on its way.",
  };

  const rows: EmailDetailRow[] = order.items.map((i) => ({
    label: `${i.productSnapshot.name.en} ×${i.qty}`,
    value: formatBDT(i.lineTotalMinor),
  }));
  if (event === "shipped" && order.trackingNumber) {
    rows.push({ label: "Tracking", value: order.trackingNumber });
  }
  rows.push({
    label: "Total",
    value: formatBDT(order.totalMinor),
    strong: true,
  });

  const { html, text, attachments } = renderEmail({
    accent: "teal",
    preheader: introMap[event],
    eyebrow: eyebrowMap[event],
    heading: headingMap[event],
    paragraphs: [introMap[event]],
    details: { title: `Order ${order.orderNumber}`, rows },
  });
  await getMailer().send({
    to: order.email,
    subject: subjectMap[event],
    html,
    text,
    attachments,
  });
}
