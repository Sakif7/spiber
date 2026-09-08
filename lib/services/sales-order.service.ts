import { randomBytes } from "node:crypto";
import { salesOrderNumber } from "@/lib/ids";
import { logger } from "@/lib/log";
import type { ISalesOrder, ISalesOrderItem } from "@/lib/models/salesOrder";
import type { Lean } from "@/lib/models/_shared";
import {
  SALES_ORDER_TRANSITIONS,
  EDITABLE_STATUSES,
  priceSalesOrder,
  type SalesOrderStatus,
  type SalesOrderItemInput,
  type SalesOrderCreateInput,
  type SalesOrderUpdateInput,
  type SalesOrderPaymentInput,
} from "@/lib/schemas/sales-order";
import {
  createSalesOrder,
  getSalesOrderById,
  updateSalesOrder,
  transitionSalesOrderIfCurrent,
  addSalesOrderActivity,
  outstandingReservations,
  getSalesLeadById,
} from "@/lib/repositories/sales.repo";
import {
  reserveStock,
  releaseStock,
  deliverReserved,
  InsufficientStockError,
} from "@/lib/services/inventory.service";
import { getMedtradeCommerceSettings } from "@/lib/services/shop-settings.service";
import { getSetting } from "@/lib/repositories/settings.repo";
import { advanceLead } from "@/lib/services/sales-lead.service";

/**
 * The offline sales pipeline.
 *
 * The shape of the flow comes from how the company already works: quote a
 * hospital on a proposal, let them mark it up, amend, invoice, deliver, and get
 * paid weeks later. Two consequences run through this file:
 *
 *  - Stock is RESERVED at invoicing, not taken. The goods sit on the shelf,
 *    committed to that customer, until they are actually delivered. Anything
 *    that undoes the invoice gives the reservation back.
 *  - Money is only revenue when it is recorded as received, which can be long
 *    after delivery and is tracked separately from the fulfilment status.
 */

export type Actor = { sub: string; email: string };

export type SalesOrderError =
  | "not_found"
  | "invalid_transition"
  | "not_editable"
  | "insufficient_stock"
  | "paid_order"
  | "no_items"
  | "lead_not_found";

export type SalesResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: SalesOrderError; lineId?: string; detail?: string };

const fail = (
  code: SalesOrderError,
  extra: { lineId?: string; detail?: string } = {},
): SalesResult<never> => ({ ok: false, code, ...extra });
const done = <T>(data: T): SalesResult<T> => ({ ok: true, data });

const lineId = () => `SL-${randomBytes(6).toString("hex").toUpperCase()}`;

// ─────────────────────────── pricing helpers ───────────────────────────

async function defaultVatRateBp(): Promise<number> {
  // The same VAT setting Medtrade checkout uses, so one rate governs the
  // company's tax however a sale is made. Zero means VAT is switched off.
  const commerce = await getMedtradeCommerceSettings().catch(() => null);
  return commerce?.vatRateBp ?? 0;
}

async function defaultTerms() {
  const stored = await getSetting<{
    deliveryDays?: number;
    validityDays?: number;
    paymentDays?: number;
    returnPolicy?: string;
  }>("sales.terms").catch(() => null);
  return {
    deliveryDays: stored?.deliveryDays ?? 2,
    validityDays: stored?.validityDays ?? 7,
    paymentDays: stored?.paymentDays ?? 45,
    returnPolicy:
      stored?.returnPolicy ??
      "If any product is found to malfunction, it will be returned and replaced.",
  };
}

/** Turn validated input lines into stored items, keeping ids stable. */
function toItems(
  input: SalesOrderItemInput[],
  existing: ISalesOrderItem[] = [],
): ISalesOrderItem[] {
  const byId = new Map(existing.map((i) => [i.id, i]));
  return input.map((raw) => {
    const prior = raw.id ? byId.get(raw.id) : undefined;
    return {
      id: raw.id ?? lineId(),
      kind: raw.kind,
      productId: raw.kind === "inventory" ? (raw.productId ?? null) : null,
      variantId: raw.kind === "inventory" ? (raw.variantId ?? null) : null,
      sku: raw.sku ?? null,
      description: raw.description,
      brandOrigin: raw.brandOrigin || null,
      specification: raw.specification || null,
      unit: raw.unit || null,
      unitPriceMinor: raw.unitPriceMinor,
      qty: raw.qty,
      lineTotalMinor: raw.unitPriceMinor * raw.qty,
      // Reservations are moved deliberately below; they never follow an edit
      // implicitly, or an amendment would silently free committed stock.
      reservedQty: prior?.reservedQty ?? 0,
    };
  });
}

function totalsFor(
  items: ISalesOrderItem[],
  discountMinor: number,
  vatRateBp: number,
  deliveryMinor = 0,
) {
  return priceSalesOrder({ items, discountMinor, vatRateBp, deliveryMinor });
}

// ─────────────────────────── create and amend ───────────────────────────

export async function createOrder(
  input: SalesOrderCreateInput,
  actor: Actor,
): Promise<SalesResult<Lean<ISalesOrder>>> {
  const lead = await getSalesLeadById(input.leadId);
  if (!lead) return fail("lead_not_found");

  const items = toItems(input.items);
  const vatRateBp = input.vatRateBp ?? 0;
  const totals = totalsFor(
    items,
    input.discountMinor ?? 0,
    vatRateBp,
    input.deliveryMinor ?? 0,
  );
  const terms = { ...(await defaultTerms()), ...(input.terms ?? {}) };

  const doc = await createSalesOrder({
    number: salesOrderNumber(),
    leadId: String(lead._id),
    leadSnapshot: {
      organisation: lead.organisation,
      code: lead.code,
      contactName: lead.contactName,
      phone: lead.phone,
      email: lead.email ?? null,
      address: lead.address,
    },
    items,
    ...totals,
    vatRateBp,
    referenceNo: input.referenceNo || null,
    terms,
    status: "draft",
    note: input.note ?? null,
    createdBy: actor.sub,
  });

  await addSalesOrderActivity(String(doc._id), {
    authorId: actor.sub,
    body: "Order created",
    to: "draft",
  });
  return done(doc.toObject() as Lean<ISalesOrder>);
}

/**
 * Amend an order's lines, discount or terms.
 *
 * While the order is invoiced the stock reservation follows the edit line by
 * line: an increased quantity reserves the difference, a decreased or removed
 * line gives it back. If any increase cannot be covered, everything this call
 * reserved is released and the order is left exactly as it was — a half-applied
 * amendment would leave stock committed to lines that no longer exist.
 */
export async function amendOrder(
  id: string,
  input: SalesOrderUpdateInput,
  actor: Actor,
): Promise<SalesResult<Lean<ISalesOrder>>> {
  const order = await getSalesOrderById(id);
  if (!order) return fail("not_found");
  if (!EDITABLE_STATUSES.includes(order.status)) return fail("not_editable");

  const nextItems =
    input.items !== undefined ? toItems(input.items, order.items) : order.items;
  const discountMinor = input.discountMinor ?? order.discountMinor;
  const deliveryMinor = input.deliveryMinor ?? order.deliveryMinor ?? 0;
  const vatRateBp = input.vatRateBp ?? order.vatRateBp;

  // Only an invoiced order holds stock; a draft has nothing to adjust.
  const applied: { item: ISalesOrderItem; qty: number }[] = [];
  if (order.status === "invoiced" && input.items !== undefined) {
    const priorById = new Map(order.items.map((i) => [i.id, i]));

    try {
      for (const item of nextItems) {
        if (item.kind !== "inventory" || !item.productId) continue;
        const prior = priorById.get(item.id);
        const have = prior?.reservedQty ?? 0;
        const want = item.qty;
        if (want > have) {
          await reserveStock({
            productId: String(item.productId),
            variantId: item.variantId ?? null,
            qty: want - have,
            refSalesOrderId: id,
            createdBy: actor.sub,
            reason: `amended ${order.number}`,
          });
          applied.push({ item, qty: want - have });
        } else if (want < have) {
          await releaseStock({
            productId: String(item.productId),
            variantId: item.variantId ?? null,
            qty: have - want,
            refSalesOrderId: id,
            createdBy: actor.sub,
            reason: `amended ${order.number}`,
          });
        }
        item.reservedQty = want;
      }

      // Lines that disappeared entirely give back everything they held.
      const keptIds = new Set(nextItems.map((i) => i.id));
      for (const prior of order.items) {
        if (
          keptIds.has(prior.id) ||
          !prior.productId ||
          prior.reservedQty <= 0
        ) {
          continue;
        }
        await releaseStock({
          productId: String(prior.productId),
          variantId: prior.variantId ?? null,
          qty: prior.reservedQty,
          refSalesOrderId: id,
          createdBy: actor.sub,
          reason: `line removed from ${order.number}`,
        });
      }
    } catch (e) {
      // Undo only what this call reserved, then report the offending line.
      for (const a of applied) {
        await releaseStock({
          productId: String(a.item.productId),
          variantId: a.item.variantId ?? null,
          qty: a.qty,
          refSalesOrderId: id,
          createdBy: actor.sub,
          reason: "amendment rolled back",
        }).catch(() => null);
      }
      if (e instanceof InsufficientStockError) {
        return fail("insufficient_stock", { lineId: e.productId });
      }
      throw e;
    }
  }

  const totals = totalsFor(nextItems, discountMinor, vatRateBp, deliveryMinor);
  const updated = await updateSalesOrder(id, {
    items: nextItems,
    ...totals,
    vatRateBp,
    ...(input.referenceNo !== undefined
      ? { referenceNo: input.referenceNo }
      : {}),
    ...(input.terms ? { terms: { ...order.terms, ...input.terms } } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
  });
  if (!updated) return fail("not_found");

  await addSalesOrderActivity(id, {
    authorId: actor.sub,
    body: "Order amended",
  });
  return done(updated);
}

// ───────────────────────────── transitions ─────────────────────────────

/** Give back everything the ledger says this order still holds. */
async function releaseAll(id: string, actor: Actor, reason: string) {
  for (const r of await outstandingReservations(id)) {
    await releaseStock({
      productId: r.productId,
      variantId: r.variantId,
      qty: r.qty,
      refSalesOrderId: id,
      createdBy: actor.sub,
      reason,
    }).catch((e) => logger.warn("sales: release failed", e));
  }
  const order = await getSalesOrderById(id);
  if (order) {
    await updateSalesOrder(id, {
      items: order.items.map((i) => ({ ...i, reservedQty: 0 })),
    });
  }
}

/**
 * Reserve stock for every inventory line, then commit the status.
 *
 * Order matters: stock first, status second, with a compare-and-set. If another
 * admin moved the order in between, the reservation is undone rather than left
 * committed to an order that is no longer being invoiced.
 */
async function reserveForInvoice(
  order: Lean<ISalesOrder>,
  actor: Actor,
): Promise<SalesResult<ISalesOrderItem[]>> {
  const id = String(order._id);
  const applied: { item: ISalesOrderItem; qty: number }[] = [];
  const items = order.items.map((i) => ({ ...i }));

  try {
    for (const item of items) {
      if (item.kind !== "inventory" || !item.productId) continue;
      const need = item.qty - item.reservedQty;
      if (need <= 0) continue;
      await reserveStock({
        productId: String(item.productId),
        variantId: item.variantId ?? null,
        qty: need,
        refSalesOrderId: id,
        createdBy: actor.sub,
        reason: `invoice ${order.number}`,
      });
      applied.push({ item, qty: need });
      item.reservedQty = item.qty;
    }
  } catch (e) {
    for (const a of applied) {
      await releaseStock({
        productId: String(a.item.productId),
        variantId: a.item.variantId ?? null,
        qty: a.qty,
        refSalesOrderId: id,
        createdBy: actor.sub,
        reason: "invoice rolled back",
      }).catch(() => null);
    }
    if (e instanceof InsufficientStockError) {
      const line = items.find(
        (i) => String(i.productId) === (e as InsufficientStockError).productId,
      );
      return fail("insufficient_stock", {
        lineId: line?.id,
        detail: line?.description,
      });
    }
    throw e;
  }
  return done(items);
}

export async function transitionOrder(
  id: string,
  to: SalesOrderStatus,
  actor: Actor,
  opts: { note?: string } = {},
): Promise<SalesResult<Lean<ISalesOrder>>> {
  const order = await getSalesOrderById(id);
  if (!order) return fail("not_found");
  const from = order.status;
  if (!SALES_ORDER_TRANSITIONS[from].includes(to)) {
    return fail("invalid_transition");
  }
  // Money already received has to be reversed before the order can be undone,
  // or the revenue figures would keep an order nobody is delivering.
  if (to === "cancelled" && order.payment.status === "paid") {
    return fail("paid_order");
  }

  if (to === "invoiced") {
    if (order.items.length === 0) return fail("no_items");
    const reserved = await reserveForInvoice(order, actor);
    if (!reserved.ok) return reserved;

    const moved = await transitionSalesOrderIfCurrent(id, from, "invoiced", {
      items: reserved.data,
    });
    if (!moved) {
      await releaseAll(id, actor, "invoice superseded");
      return fail("invalid_transition");
    }
  } else if (to === "delivered") {
    for (const r of await outstandingReservations(id)) {
      await deliverReserved({
        productId: r.productId,
        variantId: r.variantId,
        qty: r.qty,
        refSalesOrderId: id,
        createdBy: actor.sub,
        reason: `delivered ${order.number}`,
      });
    }
    await updateSalesOrder(id, {
      status: "delivered",
      deliveredAt: new Date(),
      items: order.items.map((i) => ({ ...i, reservedQty: 0 })),
    });
  } else {
    // Leaving the invoiced state — reverted or cancelled — frees the goods.
    if (from === "invoiced") {
      await releaseAll(id, actor, `reverted from invoice (${order.number})`);
      // The invoice a client already holds is superseded, not deleted.
      const invoices = order.invoices.map((v, i) =>
        i === order.invoices.length - 1 && !v.supersededAt
          ? { ...v, supersededAt: new Date() }
          : v,
      );
      await updateSalesOrder(id, { invoices });
    }
    await updateSalesOrder(id, { status: to });
  }

  await addSalesOrderActivity(id, {
    authorId: actor.sub,
    body: opts.note?.trim() || `Status changed to ${to.replace(/_/g, " ")}`,
    from,
    to,
  });

  // The lead follows its orders forward: an invoice means the deal is won.
  if (to === "invoiced") {
    await advanceLead(String(order.leadId), "won").catch(() => null);
  } else if (to === "proposal_returned") {
    await advanceLead(String(order.leadId), "negotiating").catch(() => null);
  }

  const fresh = await getSalesOrderById(id);
  return fresh ? done(fresh) : fail("not_found");
}

// ────────────────────────────── payment ──────────────────────────────

/**
 * Record (or reverse) payment.
 *
 * Deliberately independent of delivery: an invoice is often paid weeks after
 * the goods arrive, and occasionally before they leave. This is the only thing
 * that puts a sales order into the revenue figures.
 */
export async function recordPayment(
  id: string,
  input: SalesOrderPaymentInput,
  actor: Actor,
): Promise<SalesResult<Lean<ISalesOrder>>> {
  const order = await getSalesOrderById(id);
  if (!order) return fail("not_found");
  if (order.status === "cancelled") return fail("invalid_transition");

  if (input.status === "paid") {
    if (order.status === "draft" || order.status === "proposal_generated") {
      // Nothing has been invoiced yet, so there is nothing to pay against.
      return fail("invalid_transition");
    }
    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    await updateSalesOrder(id, {
      payment: {
        status: "paid",
        paidAt,
        method: input.method,
        reference: input.reference || null,
        note: input.note || null,
        recordedBy: actor.sub,
      },
    });
    await addSalesOrderActivity(id, {
      authorId: actor.sub,
      body: `Payment recorded (${input.method}${input.reference ? ` · ${input.reference}` : ""})`,
    });
  } else {
    await updateSalesOrder(id, {
      payment: {
        status: "unpaid",
        paidAt: null,
        method: null,
        reference: null,
        note: input.note || null,
        recordedBy: actor.sub,
      },
    });
    await addSalesOrderActivity(id, {
      authorId: actor.sub,
      body: "Payment reversed",
    });
  }

  const fresh = await getSalesOrderById(id);
  return fresh ? done(fresh) : fail("not_found");
}

export { defaultVatRateBp, defaultTerms };
