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
  "paid",
  "failed",
  "refunded",
]);
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;

export const paymentProviderEnum = z.enum([
  "manual",
  "sslcommerz",
  "aamarpay",
  "stripe",
]);
export type PaymentProviderName = z.infer<typeof paymentProviderEnum>;

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
export const paymentMethodEnum = z.enum(["offline", "cod", "credit"]);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

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
   * Medtrade only. Ignored on Spiber Kart (always "offline"). "credit" is
   * re-checked against an ACTIVE CreditAccount server-side before any stock
   * moves — a client can't grant itself terms.
   */
  paymentMethod: z.enum(["cod", "credit"]).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Admin order status transition input. `note` is CUSTOMER-VISIBLE (rendered
 * on their order timeline); `internalNote` is admin-only. */
export const orderTransitionSchema = z.object({
  to: orderStatusEnum,
  note: z.string().max(1000).optional(),
  internalNote: z.string().max(1000).optional(),
  trackingNumber: z.string().max(120).optional(),
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
