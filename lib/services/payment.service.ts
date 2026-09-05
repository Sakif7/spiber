import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Order, type IOrder } from "@/lib/models/order";
import {
  PaymentEvent,
  type PaymentEventResult,
} from "@/lib/models/payment-event";
import { getOrderByNumber } from "@/lib/repositories/orders.repo";
import { getPaymentProvider } from "@/lib/payments";
import type { InitiateContext, WebhookEvent } from "@/lib/payments";
import { placeOrder, transitionOrder } from "./order.service";
import type { CartOwner } from "@/lib/repositories/cart.repo";
import type { CheckoutInput } from "@/lib/schemas/order";
import { notifyAdmins } from "./notification.service";
import { PAYMENT_HOLD_MINUTES } from "@/lib/schemas/order";
import { siteConfig } from "@/lib/site-config";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";

/**
 * Online payment: handing the customer to the gateway, and taking the gateway's
 * word for it afterwards — but only once it has been verified, only once per
 * event, and only for the amount the order actually costs.
 */

/** Where the gateway sends the customer back to, either way. */
function returnContext(order: IOrder): InitiateContext {
  const base = siteConfig.url;
  // Bare paths: localePrefix is "as-needed", so English is served without a
  // prefix and "/en/..." would only cost the customer a redirect on the way
  // back from the gateway. A non-English shopper lands on the English order
  // page, because the order does not record which locale they were browsing.
  const path =
    order.storefront === "instruments"
      ? `/medtrade/order/${order.orderNumber}`
      : `/kart/order/${order.orderNumber}`;
  return {
    returnUrl: `${base}${path}`,
    cancelUrl: `${base}${path}?payment=cancelled`,
  };
}

export type InitiatePaymentResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; reason: string };

/**
 * Send a freshly placed order to the gateway.
 *
 * Marks the payment in flight and stamps the expiry that lets the sweeper
 * release the stock later, so an abandoned checkout cannot hold inventory
 * forever. Returns a reason rather than throwing when the gateway declines to
 * start, so the caller can leave the order payable another way.
 */
export async function initiatePayment(
  order: IOrder,
  orderId: string,
): Promise<InitiatePaymentResult> {
  const provider = getPaymentProvider();
  if (!provider.online) return { ok: false, reason: "provider_offline" };

  let started;
  try {
    started = await provider.initiate(order, returnContext(order));
  } catch (e) {
    logger.error("payment initiate failed", e);
    return { ok: false, reason: "initiate_failed" };
  }
  if (!started?.redirectUrl) return { ok: false, reason: "no_redirect" };

  const now = new Date();
  await Order.updateOne(
    { _id: orderId },
    {
      $set: {
        "payment.provider": provider.name,
        "payment.status": "initiated",
        "payment.initiatedAt": now,
        "payment.expiresAt": new Date(
          now.getTime() + PAYMENT_HOLD_MINUTES * 60_000,
        ),
        ...(started.reference ? { "payment.txnId": started.reference } : {}),
      },
    },
  ).exec();

  return { ok: true, redirectUrl: started.redirectUrl };
}

export type WebhookOutcome = { handled: true; result: PaymentEventResult };

/**
 * Apply one already-verified gateway callback.
 *
 * Everything here is defensive on purpose, because this endpoint is reachable
 * by anyone who can guess the URL and is retried by the gateway itself:
 *
 *  - the event is recorded FIRST, and its unique key rejects a replay before
 *    any money is applied;
 *  - the amount is checked against the order, so a tampered callback cannot
 *    settle a large order with a small payment;
 *  - a payment that lands after the order was already cancelled does not
 *    resurrect it, it raises a refund-needed alert instead.
 *
 * Always resolves. A gateway that receives an error retries, so an unhandled
 * throw turns one bad callback into a storm.
 */
export async function applyPaymentWebhook(
  provider: string,
  event: WebhookEvent,
): Promise<WebhookOutcome> {
  await connectToDatabase();

  const order = await getOrderByNumber(event.orderNumber);
  const expectedMinor = order ? order.totalMinor : null;

  const record = async (result: PaymentEventResult) => {
    await PaymentEvent.create({
      provider,
      eventId: event.eventId,
      orderId: order ? (order._id as mongoose.Types.ObjectId) : null,
      orderNumber: event.orderNumber,
      outcome: event.outcome,
      amountMinor: event.amountMinor,
      expectedMinor,
      txnId: event.txnId,
      result,
      raw: event.raw,
    });
  };

  // Claim the event before doing anything with it. A duplicate delivery
  // collides on the unique key and stops right here.
  try {
    await record("applied");
  } catch (e) {
    if (isDuplicateKey(e)) return { handled: true, result: "already_settled" };
    throw e;
  }

  const finish = async (result: PaymentEventResult) => {
    if (result !== "applied") {
      await PaymentEvent.updateOne(
        { provider, eventId: event.eventId },
        { $set: { result } },
      ).exec();
    }
    return { handled: true as const, result };
  };

  if (!order) {
    logger.warn(`payment webhook for unknown order ${event.orderNumber}`);
    return finish("order_not_found");
  }

  if (event.outcome === "failed") {
    if (order.payment.status === "initiated") {
      order.payment.status = "failed";
      order.payment.raw = event.raw;
      await order.save();
    }
    return finish("failed_payment");
  }

  // Never take a payment for less (or more) than the order costs.
  if (event.amountMinor !== order.totalMinor) {
    logger.error(
      `payment amount mismatch on ${order.orderNumber}: gateway ${event.amountMinor} vs order ${order.totalMinor}`,
    );
    await notifyAdmins({
      type: "payment.amount_mismatch",
      severity: "warning",
      title: `Payment amount mismatch on ${order.orderNumber}`,
      body: `Gateway reported ${formatBDT(event.amountMinor)} for an order of ${formatBDT(order.totalMinor)}. The order has NOT been marked paid.`,
      href: `/admin/orders/${String(order._id)}`,
      entity: {
        kind: "Order",
        id: String(order._id),
        ref: order.orderNumber,
      },
    });
    return finish("amount_mismatch");
  }

  // The money arrived after the reservation lapsed and the order was cancelled.
  // Record it and shout: this needs refunding by hand, not un-cancelling.
  if (order.status === "cancelled" || order.status === "refunded") {
    order.payment.status = "paid";
    order.payment.paidAt = new Date();
    order.payment.txnId = event.txnId ?? order.payment.txnId;
    order.payment.raw = event.raw;
    order.timeline.push({
      status: order.status,
      at: new Date(),
      internalNote: `Payment of ${formatBDT(event.amountMinor)} arrived after this order was ${order.status}. Refund required.`,
    });
    await order.save();
    await notifyAdmins({
      type: "payment.late",
      severity: "warning",
      title: `Payment received for ${order.status} order ${order.orderNumber}`,
      body: `${formatBDT(event.amountMinor)} was taken after the order was ${order.status}. It needs refunding.`,
      href: `/admin/orders/${String(order._id)}`,
      entity: {
        kind: "Order",
        id: String(order._id),
        ref: order.orderNumber,
      },
    });
    return finish("late_payment");
  }

  if (order.payment.status === "paid") return finish("already_settled");

  // Settle it. transitionOrder owns the side effects: timeline, customer email
  // and seller commission accrual.
  order.payment.txnId = event.txnId ?? order.payment.txnId;
  order.payment.raw = event.raw;
  order.payment.expiresAt = null;
  await order.save();

  const moved = await transitionOrder(String(order._id), "paid", {
    note: "Payment received",
    internalNote: `${provider} · ${event.txnId ?? event.eventId}`,
  });
  if (!moved.ok) {
    logger.error(
      `paid webhook could not transition ${order.orderNumber}: ${moved.code}`,
    );
    return finish("already_settled");
  }
  return finish("applied");
}

/**
 * Release the stock held by online payments that never arrived.
 *
 * Cancels quietly: an abandoned checkout is the common case, and emailing every
 * one of them would be noise for the customer and bad for the sending domain.
 * The cancellation is still on the order's timeline for an admin to see.
 */
export async function expireStalePayments(
  now: Date = new Date(),
): Promise<{ expired: number; orderNumbers: string[] }> {
  await connectToDatabase();

  const stale = await Order.find({
    status: "pending",
    "payment.status": "initiated",
    "payment.expiresAt": { $ne: null, $lte: now },
  })
    .select({ _id: 1, orderNumber: 1 })
    .limit(200)
    .lean<{ _id: mongoose.Types.ObjectId; orderNumber: string }[]>()
    .exec();

  const orderNumbers: string[] = [];
  for (const o of stale) {
    const res = await transitionOrder(String(o._id), "cancelled", {
      internalNote: `Payment not completed within ${PAYMENT_HOLD_MINUTES} minutes; stock released.`,
      silent: true,
    });
    if (res.ok) orderNumbers.push(o.orderNumber);
    else
      logger.warn(
        `could not expire ${o.orderNumber}: ${"code" in res ? res.code : "unknown"}`,
      );
  }

  return { expired: orderNumbers.length, orderNumbers };
}

function isDuplicateKey(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { code?: number }).code === 11000
  );
}

/** Is an online gateway configured, so checkout may offer paying now? */
export function onlinePaymentAvailable(): boolean {
  try {
    return getPaymentProvider().online;
  } catch {
    // A misconfigured PAYMENT_PROVIDER throws. Checkout should still load and
    // offer the offline methods rather than 500 on a settings mistake.
    return false;
  }
}

export type CheckoutResult =
  | { ok: true; order: IOrder; redirectUrl?: string }
  | {
      ok: false;
      code:
        | "empty_cart"
        | "out_of_stock"
        | "product_unavailable"
        | "credit_not_available"
        | "invalid_payment_method"
        | "payment_unavailable";
    };

/**
 * Place an order and, when it is to be paid online, start the payment.
 *
 * If the gateway will not start, the order is cancelled straight away rather
 * than left pending: the customer never saw a confirmation, and an order that
 * nobody can pay would otherwise sit on its reserved stock.
 */
export async function placeAndPay(
  input: CheckoutInput,
  owner: CartOwner,
  userId: string | undefined,
  storefront: "instruments" | "marketplace",
): Promise<CheckoutResult> {
  const placed = await placeOrder(input, owner, userId, storefront);
  if (!placed.ok) return placed;

  const { order, orderId } = placed;
  if ((order.payment.method ?? "offline") !== "online")
    return { ok: true, order };

  const started = await initiatePayment(order, orderId);
  if (started.ok) return { ok: true, order, redirectUrl: started.redirectUrl };

  logger.error(
    `could not start payment for ${order.orderNumber}: ${started.reason}`,
  );
  await transitionOrder(orderId, "cancelled", {
    internalNote: `Online payment could not be started (${started.reason}); stock released.`,
    silent: true,
  }).catch((e) => logger.error("could not cancel unpayable order", e));
  return { ok: false, code: "payment_unavailable" };
}
