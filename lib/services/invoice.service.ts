import type { IOrder } from "@/lib/models/order";
import type { InvoiceOrder } from "@/components/commerce/invoice-sheet";

/**
 * Serialize an order into the SAFE subset the invoice renders.
 *
 * Deliberately field-by-field rather than a spread: an invoice is a document
 * people forward, so `idempotencyKey`, `payment.raw`, `userId` and admin-only
 * internal timeline notes must never ride along.
 */
export function toInvoiceOrder(order: IOrder): InvoiceOrder {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    email: order.email,
    createdAt: new Date(order.createdAt).toISOString(),
    storefront: order.storefront,
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    shippingMinor: order.shippingMinor,
    taxMinor: order.taxMinor ?? 0,
    taxRateBp: order.taxRateBp ?? null,
    aitRateBp: order.aitRateBp ?? null,
    roundingMinor: order.roundingMinor ?? 0,
    totalMinor: order.totalMinor,
    payment: {
      // Legacy orders predate `method`; they were all offline.
      method: order.payment?.method ?? "offline",
      status: order.payment?.status ?? "unpaid",
      termsDays: order.payment?.termsDays ?? null,
      dueAt: order.payment?.dueAt
        ? new Date(order.payment.dueAt).toISOString()
        : null,
      paidAt: order.payment?.paidAt
        ? new Date(order.payment.paidAt).toISOString()
        : null,
    },
    shippingAddress: {
      label: order.shippingAddress.label,
      line1: order.shippingAddress.line1,
      line2: order.shippingAddress.line2,
      city: order.shippingAddress.city,
      district: order.shippingAddress.district,
      postalCode: order.shippingAddress.postalCode,
      phone: order.shippingAddress.phone,
    },
    items: order.items.map((i) => ({
      name: i.productSnapshot.name,
      sku: i.productSnapshot.sku,
      unitPriceMinor: i.productSnapshot.priceMinor,
      qty: i.qty,
      lineTotalMinor: i.lineTotalMinor,
      variantOptions: i.productSnapshot.variantOptions ?? [],
    })),
  };
}
