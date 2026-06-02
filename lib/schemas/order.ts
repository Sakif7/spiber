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
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Admin order status transition input. */
export const orderTransitionSchema = z.object({
  to: orderStatusEnum,
  note: z.string().max(1000).optional(),
  trackingNumber: z.string().max(120).optional(),
});
export type OrderTransitionInput = z.infer<typeof orderTransitionSchema>;

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
