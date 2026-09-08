import type { Lean } from "@/lib/models/_shared";
import type { IInventoryMovement } from "@/lib/models/inventoryMovement";
import {
  productUnitLabelsByIds,
  type ProductUnitLabels,
} from "@/lib/repositories/inventory.repo";
import { orderNumbersByIds } from "@/lib/repositories/orders.repo";
import { userNamesByIds } from "@/lib/repositories/users.repo";
import type { MovementType } from "@/lib/schemas/inventory";
import type { Storefront } from "@/lib/schemas/catalog";

/** A ledger row with every reference resolved to something readable. */
export type MovementRow = {
  id: string;
  at: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  sku: string;
  storefront: Storefront | null;
  type: MovementType;
  qtyDelta: number;
  stockAfter: number | null;
  reason: string;
  /** Friendly provenance: "Manual", "Set to", "CSV import", "Order", … */
  source: string;
  orderId: string | null;
  orderNumber: string | null;
  adminId: string | null;
  adminName: string | null;
};

/** Legacy machine reasons written by the order/product/seller flows. */
const MACHINE_REASON: Record<string, string> = {
  order: "Order placed",
  order_rollback: "Order rolled back",
  cancelled: "Order cancelled",
  refunded: "Order refunded",
  initial_stock: "Initial stock",
  variant_adjustment: "Product form",
  seller_initial_stock: "Seller initial stock",
  seller_adjustment: "Seller update",
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  set: "Set to",
  bulk: "Bulk receive",
  csv: "CSV import",
  override: "Admin override",
};

export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  purchase: "Received",
  sale: "Sale",
  adjustment: "Adjustment",
  return: "Return",
  reserve: "Reserved",
  release: "Released",
  deliver: "Delivered",
};

/** Human provenance for a movement (new `source`, else the legacy reason). */
export function movementSourceLabel(m: {
  source?: string | null;
  reason?: string;
  refOrderId?: unknown;
}): string {
  if (m.source && SOURCE_LABEL[m.source]) return SOURCE_LABEL[m.source];
  if (m.reason && MACHINE_REASON[m.reason]) return MACHINE_REASON[m.reason];
  if (m.refOrderId) return "Order";
  return m.source ? m.source : "Manual";
}

/** The admin-typed note; legacy machine reasons are shown as provenance instead. */
export function movementReasonText(m: { reason?: string }): string {
  if (!m.reason) return "";
  return MACHINE_REASON[m.reason] ? "" : m.reason;
}

export async function decorateMovements(
  items: Lean<IInventoryMovement>[],
): Promise<MovementRow[]> {
  const productIds = items.map((m) => String(m.productId));
  const orderIds = items
    .map((m) => (m.refOrderId ? String(m.refOrderId) : null))
    .filter((x): x is string => Boolean(x));
  const adminIds = items
    .map((m) => (m.createdBy ? String(m.createdBy) : null))
    .filter((x): x is string => Boolean(x));

  const none = <T>(): Record<string, T> => ({});
  const [labels, orders, admins] = await Promise.all([
    productUnitLabelsByIds(productIds).catch(none<ProductUnitLabels>),
    orderNumbersByIds(orderIds).catch(none<string>),
    userNamesByIds(adminIds).catch(none<string>),
  ]);

  return items.map((m) => {
    const pid = String(m.productId);
    const label = labels[pid];
    const variant =
      m.variantId && label ? label.variants[m.variantId] : undefined;
    const orderId = m.refOrderId ? String(m.refOrderId) : null;
    const adminId = m.createdBy ? String(m.createdBy) : null;
    return {
      id: String(m._id),
      at: new Date(m.createdAt).toISOString(),
      productId: pid,
      variantId: m.variantId ?? null,
      productName: label?.name ?? "(deleted product)",
      variantLabel: variant?.label ?? null,
      sku: variant?.sku ?? label?.sku ?? "",
      storefront: label?.storefront ?? null,
      type: m.type,
      qtyDelta: m.qtyDelta,
      stockAfter: m.stockAfter ?? null,
      reason: movementReasonText(m),
      source: movementSourceLabel(m),
      orderId,
      orderNumber: orderId ? (orders[orderId] ?? null) : null,
      adminId,
      adminName: adminId ? (admins[adminId] ?? null) : null,
    };
  });
}
