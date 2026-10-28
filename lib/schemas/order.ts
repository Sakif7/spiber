import { z } from "zod";

export const orderStatusEnum = z.enum([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);
export type OrderStatus = z.infer<typeof orderStatusEnum>;

export const paymentStatusEnum = z.enum([
  "unpaid",
  /** Sent to the gateway, waiting on the customer. Holds stock until expiry. */
  "initiated",
  "paid",
  "failed",
  "refunded",
]);
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;

export const paymentProviderEnum = z.enum([
  "manual",
  /** Built-in sandbox gateway. Refuses to run in production. */
  "dev",
  /** The live gateway (bought 2026-10). */
  "paystation",
  // Never built; kept so an order recorded against them still validates.
  "sslcommerz",
  "aamarpay",
  "stripe",
]);
export type PaymentProviderName = z.infer<typeof paymentProviderEnum>;

/**
 * Was the money taken by a gateway (not by hand)? A credit or COD order paid
 * online later records its gateway here — which is how the order, the
 * customer's page and the invoice sheet know there is nothing to collect.
 */
export function isGatewayProvider(provider: string | null | undefined) {
  return provider === "paystation" || provider === "dev";
}

/**
 * HOW the order is paid — the commercial arrangement, distinct from
 * `paymentProviderEnum` (which is the gateway seam).
 *
 *  - offline: legacy/Spiber Kart. Paid by arrangement; admin marks paid.
 *  - cod:     cash on delivery. Ships unpaid, money arrives at the door.
 *  - credit:  enlisted client billed on account (Net N); ships unpaid, invoice
 *             falls due later.
 *
 * Legacy orders have no `method` at all, so every read path uses
 * `payment.method ?? "offline"` (`.lean()` does not apply Mongoose defaults).
 */
export const paymentMethodEnum = z.enum(["offline", "online", "cod", "credit"]);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

/**
 * What each storefront may be paid with. Credit is Medtrade-only because it
 * needs an approved account; "offline" is not offered at checkout any more but
 * stays valid for legacy orders and admin-created ones.
 */
export const CHECKOUT_METHODS: Record<
  "instruments" | "marketplace",
  readonly PaymentMethod[]
> = {
  instruments: ["online", "cod", "credit"],
  marketplace: ["online", "cod"],
};

/** The method to use when the client did not choose one. */
export const DEFAULT_METHOD: Record<
  "instruments" | "marketplace",
  PaymentMethod
> = { instruments: "cod", marketplace: "offline" };

/**
 * How long an order awaiting an online payment keeps the stock it reserved at
 * placement. Past this the sweeper cancels it and returns the stock, so an
 * abandoned checkout cannot hold inventory indefinitely.
 */
export const PAYMENT_HOLD_MINUTES = 30;

export const addressSchema = z.object({
  label: z.string().max(60).optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  district: z.string().min(1).max(100),
  postalCode: z.string().max(20).optional(),
  phone: z.string().min(3).max(40),
});
export type Address = z.infer<typeof addressSchema>;

/** Checkout request body (server re-prices; never trusts client amounts). */
export const checkoutSchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email(),
  ),
  shippingAddress: addressSchema,
  couponCode: z.string().trim().max(64).optional(),
  note: z.string().max(2000).optional(),
  idempotencyKey: z.string().min(8).max(128),
  /**
   * Which of the caller's OWN carts to check out (defaults to marketplace at
   * the route). Safe from the client: it only selects between carts they
   * already own, and every price, tax rate and eligibility check is derived
   * server-side from this value.
   */
  storefront: z.enum(["instruments", "marketplace"]).optional(),
  /**
   * How the customer wants to pay. Validated against CHECKOUT_METHODS for the
   * storefront, and "credit" is re-checked against an ACTIVE CreditAccount
   * server-side before any stock moves, so a client can't grant itself terms.
   */
  paymentMethod: z.enum(["online", "cod", "credit"]).optional(),
  /** The language the shopper is browsing in, so the gateway sends them back to it. */
  locale: z.enum(["en", "bn", "ja"]).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Admin order status transition input. `note` is CUSTOMER-VISIBLE (rendered
 * on their order timeline); `internalNote` is admin-only. */
export const orderTransitionSchema = z.object({
  to: orderStatusEnum,
  note: z.string().max(1000).optional(),
  internalNote: z.string().max(1000).optional(),
  trackingNumber: z.string().max(120).optional(),
  /**
   * Cancelling or refunding an order paid online: how the money went back
   * (bKash / bank reference). Without it the payment waits under Needs refund.
   */
  refundReference: z.string().trim().max(120).optional(),
});
export type OrderTransitionInput = z.infer<typeof orderTransitionSchema>;

/** Customer refund request (paid orders; delivered within the return window). */
export const refundRequestSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});
export type RefundRequestInput = z.infer<typeof refundRequestSchema>;

/** Days after delivery during which a refund can still be requested. Keep in
 * sync with the /kart/returns policy copy. */
export const RETURN_WINDOW_DAYS = 7;

/** Allowed status transitions enforced by the order service. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "refunded", "cancelled"],
  processing: ["shipped", "refunded", "cancelled"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

/**
 * Transitions allowed for THIS order, given how it is paid.
 *
 * The base table assumes payment precedes fulfilment, which is true for
 * prepaid/offline orders but wrong for the two Medtrade methods: a COD order is
 * paid at the door and a credit order is paid weeks after delivery. Both must
 * therefore be able to move `pending → processing` while still unpaid.
 *
 * Payment itself is recorded separately (`recordOrderPayment`), which never
 * changes `status` — that is what lets a credit order reach "delivered" unpaid
 * and be settled afterwards.
 */
export function allowedOrderTransitions(
  status: OrderStatus,
  method: PaymentMethod = "offline",
): OrderStatus[] {
  const base = ORDER_TRANSITIONS[status];
  const shipsBeforePayment = method === "cod" || method === "credit";
  return status === "pending" && shipsBeforePayment
    ? [...base, "processing"]
    : base;
}
