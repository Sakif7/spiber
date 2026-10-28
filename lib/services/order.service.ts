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
  getOrderByNumber,
} from "@/lib/repositories/orders.repo";
import {
  reserveCouponUsage,
  releaseCouponUsage,
  releaseCouponUsageByCode,
} from "@/lib/repositories/coupons.repo";
import { makeId } from "@/lib/ids";
import { applyMovement, InsufficientStockError } from "./inventory.service";
import { priceCart, type PricingCoupon } from "./pricing.service";
import {
  getShippingSettings,
  getMedtradeCommerceSettings,
  taxSettingsFor,
} from "./shop-settings.service";
import { getActiveCreditAccount } from "@/lib/repositories/credit-accounts.repo";
import { validateCoupon } from "./coupon.service";
import { notifyAdmins } from "./notification.service";
import {
  accrueSellerCommissions,
  voidSellerCommissions,
} from "./seller-commission.service";
import { getPaymentProvider } from "@/lib/payments";
import { markSubjectPaymentsForRefund } from "@/lib/repositories/payment-attempts.repo";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { formatBDT } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";
import { logger } from "@/lib/log";
import {
  allowedOrderTransitions,
  CHECKOUT_METHODS,
  DEFAULT_METHOD,
  RETURN_WINDOW_DAYS,
  type CheckoutInput,
  type OrderStatus,
  type PaymentMethod,
} from "@/lib/schemas/order";
import { Order, type IOrder, type IOrderItem } from "@/lib/models/order";

const genOrderNumber = (): string => makeId("SPM");

export type PlaceOrderResult =
  | { ok: true; order: IOrder; orderId: string }
  | {
      ok: false;
      code:
        | "empty_cart"
        | "out_of_stock"
        | "product_unavailable"
        | "credit_not_available"
        | "invalid_payment_method";
    };

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
  if (existing)
    return {
      ok: true,
      order: existing.toObject(),
      orderId: String(existing._id),
    };

  // How this order is paid. Rejected rather than quietly downgraded, so a
  // client asking for something this storefront does not offer gets told.
  const requested = input.paymentMethod;
  if (requested && !CHECKOUT_METHODS[storefront].includes(requested)) {
    return { ok: false, code: "invalid_payment_method" };
  }
  const method: PaymentMethod = requested ?? DEFAULT_METHOD[storefront];

  // Credit is DB-authoritative and checked BEFORE any stock moves, so a
  // rejected credit order leaves no compensation to unwind.
  let creditTermsDays: number | null = null;
  if (method === "credit") {
    if (!userId) return { ok: false, code: "credit_not_available" };
    const account = await getActiveCreditAccount(userId);
    if (!account) return { ok: false, code: "credit_not_available" };
    creditTermsDays = account.termsDays;
  }

  const cart = await findCart(owner, storefront);
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
    // Not publicly buyable: pending/rejected listings and suspended sellers'
    // products can't be purchased through a stale cart either.
    if (
      p.approvalStatus === "pending" ||
      p.approvalStatus === "rejected" ||
      p.sellerSuspended
    ) {
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
  // VAT applies to Medtrade only; Spiber Kart passes null and stays tax-free.
  const commerce =
    storefront === "instruments" ? await getMedtradeCommerceSettings() : null;
  const tax = taxSettingsFor(commerce);
  let totals = priceCart(
    lines.map((l) => ({ priceMinor: l.priceMinor, qty: l.qty })),
    pricingCoupon,
    shipping,
    tax,
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
      // Re-price WITH the same tax settings — dropping them here would
      // silently zero the VAT on a coupon race.
      totals = priceCart(
        lines.map((l) => ({ priceMinor: l.priceMinor, qty: l.qty })),
        null,
        shipping,
        tax,
      );
    }
  }

  const items: IOrderItem[] = lines.map((l) => ({
    productId: l.product._id as unknown as mongoose.Types.ObjectId,
    productSnapshot: {
      name: l.product.name,
      sku: l.variant?.sku ?? l.product.sku,
      priceMinor: l.priceMinor,
      // Frozen at the moment of sale. A seller's listing costs us nothing —
      // their margin is theirs — so only a house product carries one.
      costPriceMinor: l.product.sellerId
        ? null
        : (l.product.costPriceMinor ?? null),
      image: l.variant?.image ?? l.product.images[0],
      variantId: l.variantId,
      variantOptions: l.variant?.options ?? [],
      sellerId: l.product.sellerId ?? null,
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
        taxRateBp: tax?.rateBp ?? null,
        // Snapshotted for the invoice note; AIT is never charged.
        aitRateBp:
          commerce && commerce.aitRateBp > 0 ? commerce.aitRateBp : null,
        discountMinor: totals.discountMinor,
        roundingMinor: totals.roundingMinor,
        totalMinor: totals.totalMinor,
        currency: "BDT",
        status: "pending",
        payment: {
          // Only an online order involves the gateway. Asking for it here
          // also makes a misconfigured gateway fail loudly at this point.
          provider: method === "online" ? getPaymentProvider().name : "manual",
          status: "unpaid",
          method,
          termsDays: creditTermsDays,
          dueAt:
            creditTermsDays != null
              ? new Date(now.getTime() + creditTermsDays * 86_400_000)
              : null,
        },
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
        if (dup)
          return { ok: true, order: dup.toObject(), orderId: String(dup._id) };
      }
      throw err;
    }
  }
  if (!createdOrder) throw new Error("order creation failed after retries");
  const order = createdOrder;

  // Scoped: checking out Medtrade must not empty the shopper's Kart cart.
  await deleteCart(owner, storefront).catch(() => {});
  // An order paid online is only an order once the money arrives: until then
  // it is a checkout that may be abandoned, and mailing (or pinging the team
  // about) every one of those is noise. Its confirmation goes out when the
  // gateway confirms the payment (see transitionOrder → "paid").
  if (method !== "online") {
    await sendOrderEmail(order, "placed").catch((e) =>
      logger.warn("order confirmation email failed", e),
    );
    await notifyNewOrder(order);
  }

  return { ok: true, order: order.toObject(), orderId: String(orderId) };
}

/** The team's bell: a new order to fulfil. */
async function notifyNewOrder(
  order: IOrder & { _id?: unknown },
  paidOnline = false,
) {
  await notifyAdmins({
    type: "order.placed",
    severity: "success",
    title: paidOnline
      ? `New order ${order.orderNumber} — paid online`
      : `New order ${order.orderNumber}`,
    body: `${order.items.reduce((n, it) => n + it.qty, 0)} item(s) · ${formatBDT(order.totalMinor)} · ${order.email}`,
    href: `/admin/orders/${String(order._id)}`,
    entity: { kind: "Order", id: String(order._id), ref: order.orderNumber },
  });
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
  opts: {
    note?: string;
    internalNote?: string;
    trackingNumber?: string;
    /**
     * Skip the customer email. Used by the payment-expiry sweeper: an
     * abandoned checkout is the common case and mailing every one of them
     * would be noise for the customer and bad for the sending domain.
     */
    silent?: boolean;
    /**
     * Cancelling/refunding an order paid online: how the money went back.
     * Without it the payment waits under Company › Payments › Needs refund.
     */
    refundReference?: string;
    actorId?: string | null;
    /**
     * Extra conditions the move must still meet at the moment it is written
     * (the sweeper insists the hold has really expired, so a customer who just
     * pressed "Pay again" is not cancelled under them).
     */
    guard?: Record<string, unknown>;
    /** Payment fields to write in the same atomic move (gateway reference…). */
    payment?: Partial<Record<"provider" | "txnId", string>>;
  } = {},
): Promise<TransitionResult> {
  const order = await getOrderById(orderId);
  if (!order) return { ok: false, code: "not_found" };
  // Method-aware: COD and credit orders ship BEFORE they are paid, so they may
  // go pending → processing. Offline/Kart orders keep the original table.
  const method = order.payment.method ?? "offline";
  if (!allowedOrderTransitions(order.status, method).includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }

  const now = new Date();
  const releasing = to === "cancelled" || to === "refunded";
  const wasPaid = order.payment.status === "paid";
  const set: Record<string, unknown> = { status: to };

  if (to === "paid") {
    set["payment.status"] = "paid";
    set["payment.paidAt"] = now;
    set["payment.expiresAt"] = null;
  }
  if (releasing) {
    // A paid order that is cancelled is effectively a refund — reconcile
    // payment so it stops counting as revenue.
    if (to === "refunded" || wasPaid) {
      set["payment.status"] = "refunded";
      set["payment.refundedAt"] = now;
    } else if (order.payment.status === "initiated") {
      // The customer was at the gateway and never came back.
      set["payment.status"] = "failed";
    }
    set["payment.expiresAt"] = null;
    // A customer's open refund request is settled by either outcome.
    if (order.refundRequest?.status === "open") {
      set["refundRequest.status"] = "resolved";
    }
  }
  if (opts.trackingNumber) set.trackingNumber = opts.trackingNumber;
  for (const [k, v] of Object.entries(opts.payment ?? {})) {
    if (v) set[`payment.${k}`] = v;
  }

  // The move itself is one conditional write on the status (and payment
  // status) we just read: a gateway confirming a payment and the sweeper
  // expiring the same order cannot both win. Everything with a side effect —
  // stock, coupon, emails, commissions — runs only for the winner.
  const moved = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: order.status,
      "payment.status": order.payment.status,
      ...(opts.guard ?? {}),
    },
    {
      $set: set,
      $push: {
        timeline: {
          status: to,
          at: now,
          note: opts.note,
          internalNote: opts.internalNote,
        },
      },
    },
    { returnDocument: "after" },
  ).exec();
  if (!moved) return { ok: false, code: "invalid_transition" };

  if (releasing) {
    // Cancelling or refunding restores the stock taken at placement.
    for (const it of moved.items) {
      await applyMovement({
        productId: String(it.productId),
        variantId: it.productSnapshot.variantId ?? null,
        type: "return",
        qtyDelta: it.qty,
        refOrderId: String(moved._id),
        reason: to,
      }).catch((e) => logger.error("restock on " + to + " failed", e));
    }
    // Return the coupon's redemption slot.
    if (moved.couponCode) {
      await releaseCouponUsageByCode(moved.couponCode).catch((e) =>
        logger.warn("coupon release failed", e),
      );
    }
    // Money taken online has to go back by hand: record how, or queue it.
    if (wasPaid) {
      await markSubjectPaymentsForRefund(
        ["order", "order_due"],
        String(moved._id),
        {
          reference: opts.refundReference,
          note: opts.internalNote,
          actorId: opts.actorId,
        },
      ).catch((e) =>
        logger.error("could not mark online payment for refund", e),
      );
    }
  }

  if (
    !opts.silent &&
    (to === "paid" ||
      to === "shipped" ||
      to === "delivered" ||
      to === "cancelled" ||
      to === "refunded")
  ) {
    await sendOrderEmail(moved, to).catch((e) =>
      logger.warn("order status email failed", e),
    );
  }

  // An online order told nobody when it was placed (it might have been
  // abandoned); now that it is paid, it is a real order for the team.
  if (to === "paid" && method === "online") await notifyNewOrder(moved, true);

  // Seller commissions: accrue when the order is paid; void the still-accrued
  // ones if it is later cancelled/refunded.
  if (to === "paid") {
    await accrueSellerCommissions(moved.toObject(), String(moved._id)).catch(
      (e) => logger.warn("accrue seller commissions failed", e),
    );
  } else if (releasing) {
    await voidSellerCommissions(String(moved._id)).catch((e) =>
      logger.warn("void seller commissions failed", e),
    );
  }

  return { ok: true, order: moved.toObject() };
}

/** "Omron Monitor (L / Black) ×2" — variant options folded into the label. */
function itemEmailLabel(i: IOrderItem): string {
  const opts = i.productSnapshot.variantOptions ?? [];
  const variant = opts.length
    ? ` (${opts.map((o) => o.value).join(" / ")})`
    : "";
  return `${i.productSnapshot.name.en}${variant} ×${i.qty}`;
}

async function sendOrderEmail(
  order: IOrder,
  event:
    | "placed"
    | "paid"
    | "payment_recorded"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded",
) {
  // "failed" (an abandoned gateway try) never took money.
  const wasPaid =
    order.payment.status === "paid" || order.payment.status === "refunded";
  const subjectMap: Record<typeof event, string> = {
    placed: `Order ${order.orderNumber} received`,
    paid: `Payment confirmed for ${order.orderNumber}`,
    payment_recorded: `Payment received for ${order.orderNumber}`,
    shipped: `Your order ${order.orderNumber} has shipped`,
    delivered: `Your order ${order.orderNumber} has been delivered`,
    cancelled: `Order ${order.orderNumber} has been cancelled`,
    refunded: `Refund issued for order ${order.orderNumber}`,
  };
  const eyebrowMap: Record<typeof event, string> = {
    placed: "Order received",
    paid: "Payment confirmed",
    payment_recorded: "Payment received",
    shipped: "On its way",
    delivered: "Delivered",
    cancelled: "Order cancelled",
    refunded: "Refund issued",
  };
  const headingMap: Record<typeof event, string> = {
    placed: "Thanks — your order is in",
    paid: "Your payment is confirmed",
    payment_recorded: "Thanks — we've received your payment",
    shipped: "Your order has shipped",
    delivered: "Your order has arrived",
    cancelled: "Your order has been cancelled",
    refunded: "Your refund is on its way",
  };
  // How this order is paid changes what "placed" should promise. Legacy orders
  // have no method and keep the original offline wording.
  const method = order.payment.method ?? "offline";
  const placedIntro =
    method === "cod"
      ? "We've received your order. Pay in cash when it's delivered — here's a summary for your records."
      : method === "credit"
        ? `We've received your order and billed it to your credit account${
            order.payment.termsDays ? ` (Net ${order.payment.termsDays})` : ""
          }${
            order.payment.dueAt
              ? `, due ${order.payment.dueAt.toISOString().slice(0, 10)}`
              : ""
          }. Here's a summary for your records.`
        : "We've received your order and will confirm your offline payment shortly. Here's a summary for your records.";

  const introMap: Record<typeof event, string> = {
    placed: placedIntro,
    paid: "Your payment has been confirmed — we're now preparing your order for shipment.",
    payment_recorded:
      method === "credit"
        ? "We've recorded your payment against your credit account. This invoice is now settled."
        : "We've recorded the payment for this order. Thank you.",
    shipped: "Good news — your order is on its way.",
    delivered:
      "Your order has been delivered. We hope everything arrived in perfect condition — if not, our returns policy has you covered.",
    cancelled: wasPaid
      ? "Your order has been cancelled. Since it was already paid, your payment will be refunded per our returns policy."
      : "Your order has been cancelled. No payment was collected for it.",
    refunded:
      "We've issued your refund for this order. Depending on the payment method, it can take a few business days to reach you.",
  };

  const rows: EmailDetailRow[] = order.items.map((i) => ({
    label: itemEmailLabel(i),
    value: formatBDT(i.lineTotalMinor),
  }));
  if (event === "shipped" && order.trackingNumber) {
    rows.push({ label: "Tracking", value: order.trackingNumber });
  }
  if (order.taxMinor > 0) {
    rows.push({
      label: order.taxRateBp ? `VAT (${order.taxRateBp / 100}%)` : "VAT",
      value: formatBDT(order.taxMinor),
    });
  }
  if ((order.roundingMinor ?? 0) !== 0) {
    rows.push({
      label: "Rounding",
      value: `− ${formatBDT(-(order.roundingMinor ?? 0))}`,
    });
  }
  rows.push({
    label: "Total",
    value: formatBDT(order.totalMinor),
    strong: true,
  });
  if (method === "credit" && order.payment.dueAt) {
    rows.push({
      label: "Payment due",
      value: order.payment.dueAt.toISOString().slice(0, 10),
    });
  }

  // Self-serve invoice: the recipient owns this email address, and the route
  // re-checks the number + email pair before rendering anything.
  const invoiceUrl = `${siteConfig.url}/en/invoice/${order.orderNumber}?email=${encodeURIComponent(order.email)}`;

  const { html, text, attachments } = renderEmail({
    accent: "teal",
    preheader: introMap[event],
    eyebrow: eyebrowMap[event],
    heading: headingMap[event],
    paragraphs: [introMap[event]],
    details: { title: `Order ${order.orderNumber}`, rows },
    outro: [`View or print your invoice: ${invoiceUrl}`],
  });
  await getMailer().send({
    to: order.email,
    subject: subjectMap[event],
    html,
    text,
    attachments,
  });
}

// ---- Customer self-service (cancel + refund request) ----

export type SelfService = {
  /** Unpaid pending orders can be cancelled by their owner directly. */
  canCancel: boolean;
  /** Paid orders (through delivery, within the return window) can request a refund. */
  canRequestRefund: boolean;
  /** Delivered, but the return window has passed. */
  refundWindowClosed: boolean;
  /** ISO date of an open refund request, if any. */
  refundRequestedAt: string | null;
};

/** Pure eligibility rules — shared by the API routes and the account pages. */
export function computeSelfService(
  order: Pick<IOrder, "status" | "refundRequest" | "timeline" | "updatedAt">,
  now: Date = new Date(),
): SelfService {
  const requested =
    order.refundRequest?.status === "open"
      ? new Date(order.refundRequest.requestedAt).toISOString()
      : null;

  if (requested) {
    return {
      canCancel: false,
      canRequestRefund: false,
      refundWindowClosed: false,
      refundRequestedAt: requested,
    };
  }

  if (order.status === "pending") {
    return {
      canCancel: true,
      canRequestRefund: false,
      refundWindowClosed: false,
      refundRequestedAt: null,
    };
  }

  if (["paid", "processing", "shipped"].includes(order.status)) {
    return {
      canCancel: false,
      canRequestRefund: true,
      refundWindowClosed: false,
      refundRequestedAt: null,
    };
  }

  if (order.status === "delivered") {
    const deliveredEntry = [...order.timeline]
      .reverse()
      .find((e) => e.status === "delivered");
    const deliveredAt = deliveredEntry
      ? new Date(deliveredEntry.at)
      : new Date(order.updatedAt);
    const windowMs = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const inWindow = now.getTime() - deliveredAt.getTime() <= windowMs;
    return {
      canCancel: false,
      canRequestRefund: inWindow,
      refundWindowClosed: !inWindow,
      refundRequestedAt: null,
    };
  }

  return {
    canCancel: false,
    canRequestRefund: false,
    refundWindowClosed: false,
    refundRequestedAt: null,
  };
}

export type SelfServiceResult =
  | { ok: true; order: IOrder }
  | { ok: false; code: "not_found" | "not_allowed" };

/**
 * Customer cancels their own order. Only unpaid `pending` orders qualify (no
 * money has moved); anything later goes through a refund REQUEST that an admin
 * settles — money movements stay admin-controlled.
 */
export async function cancelOwnOrder(
  orderNumber: string,
  userId: string,
): Promise<SelfServiceResult> {
  const order = await getOrderByNumber(orderNumber);
  if (!order || String(order.userId ?? "") !== userId) {
    return { ok: false, code: "not_found" };
  }
  if (!computeSelfService(order).canCancel) {
    return { ok: false, code: "not_allowed" };
  }
  const result = await transitionOrder(String(order._id), "cancelled", {
    note: "Cancelled by customer",
  });
  if (!result.ok) return { ok: false, code: "not_allowed" };
  return { ok: true, order: result.order };
}

export type RecordPaymentResult =
  | { ok: true; order: IOrder }
  | { ok: false; code: "not_found" | "not_recordable" };

/**
 * Record that a COD or credit order has been paid, WITHOUT moving its status.
 *
 * These two methods invert the usual order: the goods ship first and the money
 * arrives later (at the door for COD, on terms for credit). The status machine
 * therefore can't carry payment — a delivered order has nowhere left to go but
 * "refunded". So payment is recorded here as its own fact: payment.status flips
 * to "paid", a timeline entry appears at the CURRENT status, and fulfilment is
 * untouched.
 *
 * Offline/Kart orders are deliberately excluded: they're paid via the normal
 * pending → paid transition, and allowing both paths would let an admin mark
 * one paid in two different ways.
 */
export async function recordOrderPayment(
  orderId: string,
  opts: {
    txnId?: string;
    note?: string;
    internalNote?: string;
    /** Set when the money came through the gateway ("paystation"). */
    provider?: string;
  } = {},
): Promise<RecordPaymentResult> {
  const order = await getOrderById(orderId);
  if (!order) return { ok: false, code: "not_found" };

  const method = order.payment.method ?? "offline";
  const recordable =
    (method === "cod" || method === "credit") &&
    order.payment.status === "unpaid" &&
    order.status !== "cancelled" &&
    order.status !== "refunded";
  if (!recordable) return { ok: false, code: "not_recordable" };

  const now = new Date();
  const set: Record<string, unknown> = {
    "payment.status": "paid",
    "payment.paidAt": now,
  };
  if (opts.txnId) set["payment.txnId"] = opts.txnId;
  if (opts.provider) set["payment.provider"] = opts.provider;
  // One conditional write, so an admin recording cash and the customer paying
  // the same bill online cannot both mark it paid.
  const moved = await Order.findOneAndUpdate(
    {
      _id: order._id,
      "payment.status": "unpaid",
      status: { $nin: ["cancelled", "refunded"] },
    },
    {
      $set: set,
      $push: {
        timeline: {
          status: order.status, // unchanged — a payment fact, not a move
          at: now,
          note: opts.note ?? "Payment received",
          internalNote: opts.internalNote,
        },
      },
    },
    { returnDocument: "after" },
  ).exec();
  if (!moved) return { ok: false, code: "not_recordable" };

  await sendOrderEmail(moved, "payment_recorded").catch((e) =>
    logger.warn("payment recorded email failed", e),
  );
  // Idempotent (unique index on order+seller); a no-op for house products.
  await accrueSellerCommissions(moved.toObject(), String(moved._id)).catch(
    (e) => logger.warn("accrue seller commissions failed", e),
  );

  return { ok: true, order: moved.toObject() };
}

/**
 * Customer requests a refund on a paid/processing/shipped order, or a
 * delivered one within the return window. Records the request on the order,
 * notifies the team, and acknowledges the customer. An admin settles it with
 * the existing cancel/refund transitions.
 */
export async function requestRefund(
  orderNumber: string,
  userId: string,
  reason: string,
): Promise<SelfServiceResult> {
  const order = await getOrderByNumber(orderNumber);
  if (!order || String(order.userId ?? "") !== userId) {
    return { ok: false, code: "not_found" };
  }
  if (!computeSelfService(order).canRequestRefund) {
    return { ok: false, code: "not_allowed" };
  }

  const now = new Date();
  order.refundRequest = { reason, requestedAt: now, status: "open" };
  order.timeline.push({
    status: order.status,
    at: now,
    note: `Refund requested: ${reason}`,
  });
  await order.save();

  const teamTo =
    process.env.KART_TEAM_EMAIL ||
    process.env.CONTACT_TEAM_EMAIL ||
    "info@spibermed.com";
  const teamEmail = renderEmail({
    accent: "orange",
    preheader: `Refund requested on ${order.orderNumber}`,
    eyebrow: "Refund request",
    heading: `Refund requested — ${order.orderNumber}`,
    paragraphs: [
      `${order.email} requested a refund on order ${order.orderNumber} (status: ${order.status}).`,
      `Reason: ${reason}`,
      "Review it in the admin and settle with the Cancel/Refund actions.",
    ],
    details: {
      title: `Order ${order.orderNumber}`,
      rows: [
        ...order.items.map((i) => ({
          label: itemEmailLabel(i),
          value: formatBDT(i.lineTotalMinor),
        })),
        { label: "Total", value: formatBDT(order.totalMinor), strong: true },
      ],
    },
  });
  const ackEmail = renderEmail({
    accent: "teal",
    preheader: `We received your refund request for ${order.orderNumber}.`,
    eyebrow: "Refund request received",
    heading: "We're on it",
    paragraphs: [
      `We've received your refund request for order ${order.orderNumber} and our team will review it shortly.`,
      "You'll get a confirmation email as soon as it is settled.",
    ],
  });
  const results = await Promise.allSettled([
    getMailer().send({
      to: teamTo,
      subject: `Refund request — ${order.orderNumber}`,
      html: teamEmail.html,
      text: teamEmail.text,
      attachments: teamEmail.attachments,
    }),
    getMailer().send({
      to: order.email,
      subject: `We received your refund request for ${order.orderNumber}`,
      html: ackEmail.html,
      text: ackEmail.text,
      attachments: ackEmail.attachments,
    }),
  ]);
  for (const r of results) {
    if (r.status === "rejected") {
      logger.warn("refund request email failed", r.reason);
    }
  }
  await notifyAdmins({
    type: "order.refund_requested",
    severity: "warning",
    title: `Refund requested — ${order.orderNumber}`,
    body: `${formatBDT(order.totalMinor)} · ${order.email}`,
    href: `/admin/orders/${String(order._id)}`,
    entity: { kind: "Order", id: String(order._id), ref: order.orderNumber },
  });

  return { ok: true, order: order.toObject() };
}
