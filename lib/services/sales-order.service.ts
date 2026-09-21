import { randomBytes } from "node:crypto";
import { salesOrderNumber } from "@/lib/ids";
import { logger } from "@/lib/log";
import type { ISalesOrder, ISalesOrderItem } from "@/lib/models/salesOrder";
import type { Lean } from "@/lib/models/_shared";
import {
  SALES_ORDER_TRANSITIONS,
  EDITABLE_STATUSES,
  priceSalesOrder,
  aitBaseMinor,
  aitOnGoods,
  type SalesOrderStatus,
  type SalesOrderItemInput,
  type SalesOrderCreateInput,
  type SalesOrderUpdateInput,
  type SalesOrderPaymentInput,
  type WithholdingInput,
  type OrderCostsInput,
  type AmendCostsInput,
} from "@/lib/schemas/sales-order";
import {
  createSalesOrder,
  getSalesOrderById,
  updateSalesOrder,
  transitionSalesOrderIfCurrent,
  addSalesOrderActivity,
  outstandingReservations,
  getSalesLeadById,
  currentProductPrices,
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
      // Equipment fields; a consumables line simply leaves them blank.
      model: raw.model || null,
      manufacturer: raw.manufacturer || null,
      origin: raw.origin || null,
      serialNo: raw.serialNo || null,
      unit: raw.unit || null,
      unitPriceMinor: raw.unitPriceMinor,
      // Undefined means the caller sent no opinion, so keep what the line already
      // said; null is a deliberate "we do not know what this cost".
      unitCostMinor:
        raw.unitCostMinor === undefined
          ? (prior?.unitCostMinor ?? null)
          : raw.unitCostMinor,
      // As entered: a rate, or a figure, or neither. `vatMinor` below is what
      // it works out at, and is filled in by `totalsFor` once every line is
      // known — one line's VAT decides whether ANY line has its own.
      vatRateBp: raw.vatRateBp ?? null,
      vatAmountMinor: raw.vatAmountMinor ?? null,
      vatMinor: 0,
      qty: raw.qty,
      lineTotalMinor: raw.unitPriceMinor * raw.qty,
      // Reservations are moved deliberately below; they never follow an edit
      // implicitly, or an amendment would silently free committed stock.
      reservedQty: prior?.reservedQty ?? 0,
    };
  });
}

/**
 * Price the order and stamp each line with the VAT it carries.
 *
 * Returns the items as well as the totals because per-line VAT can only be
 * settled once every line is in hand: a single line with its own rate takes
 * the whole order out of order-rate mode, and the others then owe nothing.
 * Callers must persist the returned `items`, not the ones they passed in.
 */
function priceOrder(
  items: ISalesOrderItem[],
  discountMinor: number,
  vatRateBp: number,
  deliveryMinor = 0,
): { items: ISalesOrderItem[]; totals: OrderTotals } {
  const priced = priceSalesOrder({
    items,
    discountMinor,
    vatRateBp,
    deliveryMinor,
  });
  return {
    items: items.map((it, i) => ({
      ...it,
      // In order-rate mode the VAT belongs to the order, not to any line.
      vatMinor: priced.perLineVat ? (priced.lineVatMinor[i] ?? 0) : 0,
    })),
    totals: {
      subtotalMinor: priced.subtotalMinor,
      discountMinor: priced.discountMinor,
      vatMinor: priced.vatMinor,
      deliveryMinor: priced.deliveryMinor,
      totalMinor: priced.totalMinor,
    },
  };
}

type OrderTotals = {
  subtotalMinor: number;
  discountMinor: number;
  vatMinor: number;
  deliveryMinor: number;
  totalMinor: number;
};

// ─────────────────────────── create and amend ───────────────────────────

export async function createOrder(
  input: SalesOrderCreateInput,
  actor: Actor,
): Promise<SalesResult<Lean<ISalesOrder>>> {
  const lead = await getSalesLeadById(input.leadId);
  if (!lead) return fail("lead_not_found");

  const vatRateBp = input.vatRateBp ?? 0;
  const { items, totals } = priceOrder(
    toItems(input.items),
    input.discountMinor ?? 0,
    vatRateBp,
    input.deliveryMinor ?? 0,
  );
  const terms = { ...(await defaultTerms()), ...(input.terms ?? {}) };

  const doc = await createSalesOrder({
    number: salesOrderNumber(),
    kind: input.kind ?? "consumables",
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
    aitRateBp: input.aitRateBp ?? 0,
    referenceNo: input.referenceNo || null,
    terms,
    status: "draft",
    note: input.note ?? null,
    createdBy: actor.sub,
  });

  await addSalesOrderActivity(String(doc._id), {
    authorId: actor.sub,
    body:
      input.kind === "equipment"
        ? "Order created (equipment)"
        : "Order created",
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

  const { items: pricedItems, totals } = priceOrder(
    nextItems,
    discountMinor,
    vatRateBp,
    deliveryMinor,
  );
  // The kind decides which documents the order produces, so it may only
  // change while none has been produced: a draft with no proposal behind it.
  // Any later attempt is ignored rather than refused — the editor sends the
  // field every time.
  const kindChange =
    input.kind !== undefined &&
    order.status === "draft" &&
    order.proposals.length === 0 &&
    input.kind !== (order.kind ?? "consumables")
      ? { kind: input.kind }
      : {};

  const updated = await updateSalesOrder(id, {
    items: pricedItems,
    ...totals,
    vatRateBp,
    ...kindChange,
    ...(input.aitRateBp !== undefined ? { aitRateBp: input.aitRateBp } : {}),
    ...(input.referenceNo !== undefined
      ? { referenceNo: input.referenceNo }
      : {}),
    ...(input.terms ? { terms: { ...order.terms, ...input.terms } } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
  });
  if (!updated) return fail("not_found");

  await addSalesOrderActivity(id, {
    authorId: actor.sub,
    body: kindChange.kind
      ? `Order amended — now an ${kindChange.kind} order`
      : "Order amended",
  });
  return done(updated);
}

/**
 * Raise the same order again for the same client.
 *
 * A hospital that liked what it bought asks for it again, and quoting them for
 * something they have already agreed to is a step nobody needs. The copy is a
 * fresh draft — its own number, its own invoice number when it gets one — and
 * it can be invoiced without a proposal.
 *
 * Prices come across as they were AGREED, not as the catalogue reads today:
 * re-pricing a repeat would quietly change a deal neither side renegotiated.
 * Where the catalogue has since moved, the difference is reported so somebody
 * decides on purpose.
 */
export async function repeatOrder(
  sourceId: string,
  actor: Actor,
): Promise<
  SalesResult<{
    order: Lean<ISalesOrder>;
    /** Lines whose catalogue price is no longer the one being copied. */
    priceChanges: {
      description: string;
      wasMinor: number;
      nowMinor: number;
    }[];
  }>
> {
  const source = await getSalesOrderById(sourceId);
  if (!source) return fail("not_found");
  if (source.items.length === 0) return fail("no_items");

  const lead = await getSalesLeadById(String(source.leadId));
  if (!lead) return fail("lead_not_found");

  // Fresh line ids: the copy is its own order, and sharing an id with the
  // order it came from would tangle the two reservation ledgers together.
  const items: ISalesOrderItem[] = source.items.map((i) => ({
    ...i,
    id: lineId(),
    reservedQty: 0,
    // A repeat is a new machine: its serial number is not the old one's.
    serialNo: null,
  }));

  // Best effort: a catalogue lookup that fails must not stop the repeat. The
  // copy is still correct, it just cannot report what has moved.
  const catalogue = await currentProductPrices(
    items.map((i) => String(i.productId ?? "")),
  ).catch(() => new Map<string, number | null>());

  const priceChanges: {
    description: string;
    wasMinor: number;
    nowMinor: number;
  }[] = [];
  for (const i of items) {
    if (i.kind !== "inventory" || !i.productId) continue;
    const key = i.variantId
      ? `${String(i.productId)}:${i.variantId}`
      : String(i.productId);
    const now = catalogue.get(key);
    if (typeof now === "number" && now !== i.unitPriceMinor) {
      priceChanges.push({
        description: i.description,
        wasMinor: i.unitPriceMinor,
        nowMinor: now,
      });
    }
  }

  const { items: priced, totals } = priceOrder(
    items,
    source.discountMinor,
    source.vatRateBp,
    source.deliveryMinor ?? 0,
  );

  const doc = await createSalesOrder({
    number: salesOrderNumber(),
    kind: source.kind ?? "consumables",
    leadId: String(lead._id),
    // Taken from the lead as it reads NOW: the client may have moved offices
    // or changed the person who signs since the order being copied.
    leadSnapshot: {
      organisation: lead.organisation,
      code: lead.code,
      contactName: lead.contactName,
      phone: lead.phone,
      email: lead.email ?? null,
      address: lead.address,
    },
    items: priced,
    ...totals,
    vatRateBp: source.vatRateBp,
    aitRateBp: source.aitRateBp ?? 0,
    // The client's old purchase-order number belongs to the old order.
    referenceNo: null,
    terms: source.terms,
    status: "draft",
    note: source.note ?? null,
    createdBy: actor.sub,
  });

  const id = String(doc._id);
  await addSalesOrderActivity(id, {
    authorId: actor.sub,
    body: `Repeated from ${source.number}`,
    to: "draft",
  });
  if (priceChanges.length > 0) {
    await addSalesOrderActivity(id, {
      authorId: actor.sub,
      body: `Copied at the agreed prices. The catalogue has since changed on ${priceChanges.length} line${priceChanges.length === 1 ? "" : "s"}: ${priceChanges
        .map(
          (c) =>
            `${c.description} ${(c.wasMinor / 100).toFixed(2)} → ${(c.nowMinor / 100).toFixed(2)}`,
        )
        .join("; ")}`,
    });
  }

  return done({
    order: doc.toObject() as Lean<ISalesOrder>,
    priceChanges,
  });
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
/**
 * Record what the buyer is withholding.
 *
 * This happens AFTER the invoice has gone out: the client receives the bill,
 * says they are deducting 5% AIT, and the figure is written here. The invoice
 * keeps its number and is reissued as a new version showing the deduction and
 * what is now payable, so the payment they send matches the paper we hold.
 *
 * Nothing about revenue changes. The withheld money is still ours — it sits
 * with the tax office against our own income tax and returns with the
 * certificate — so it must never reach gross profit.
 */
/**
 * What this sale cost us beyond the goods.
 *
 * Delivery, a courier, installation, a commission — money spent on the job
 * that never appears on the client's invoice. Kept as a list on the order so
 * the report can say what the sale actually made rather than what the goods
 * margin flattered it to.
 *
 * Editable at any point in the order's life, including long after it is paid,
 * because a freight bill often arrives weeks later. Every change is audited by
 * the route, and a reason is recorded on the order's own history.
 */
export async function setOrderCosts(
  id: string,
  input: OrderCostsInput,
  actor: Actor,
): Promise<SalesResult<Lean<ISalesOrder>>> {
  const order = await getSalesOrderById(id);
  if (!order) return fail("not_found");

  const now = new Date();
  const existing = new Map((order.costs ?? []).map((c) => [c.id, c]));
  const costs = input.costs.map((c) => {
    const prior = c.id ? existing.get(c.id) : undefined;
    return {
      id: c.id ?? lineId(),
      label: c.label,
      amountMinor: c.amountMinor,
      note: c.note || null,
      // Keep who first entered it; only new rows get today's stamp.
      addedAt: prior?.addedAt ?? now,
      addedBy: prior?.addedBy ?? actor.sub,
    };
  });

  await updateSalesOrder(id, { costs });

  const total = costs.reduce((t, c) => t + c.amountMinor, 0);
  await addSalesOrderActivity(id, {
    authorId: actor.sub,
    body: `Order costs set: ${costs.length} item${costs.length === 1 ? "" : "s"}, ${(
      total / 100
    ).toLocaleString(
      "en-BD",
    )} total${input.reason ? ` — ${input.reason}` : ""}`,
  });

  const fresh = await getSalesOrderById(id);
  return fresh ? done(fresh) : fail("not_found");
}

/**
 * Correct what a line cost us, after the order can no longer be edited.
 *
 * The invoice is a document the client already holds, so nothing about what
 * they were charged may change here — only our own cost, which never appeared
 * on it. That is the whole reason this is a separate action from editing the
 * order: it cannot touch price, quantity or description, so it cannot put the
 * report out of step with the paper.
 *
 * A reason is required, and the before/after of every line that moved goes on
 * the order's history as well as the audit log.
 */
export async function amendLineCosts(
  id: string,
  input: AmendCostsInput,
  actor: Actor,
): Promise<SalesResult<{ changed: number }>> {
  const order = await getSalesOrderById(id);
  if (!order) return fail("not_found");

  const wanted = new Map(input.lines.map((l) => [l.id, l.unitCostMinor]));
  const changes: string[] = [];
  const items = order.items.map((i) => {
    if (!wanted.has(i.id)) return i;
    const next = wanted.get(i.id) ?? null;
    const prev = i.unitCostMinor ?? null;
    if (next === prev) return i;
    changes.push(
      `${i.description}: ${prev == null ? "—" : (prev / 100).toLocaleString("en-BD")} → ${
        next == null ? "—" : (next / 100).toLocaleString("en-BD")
      }`,
    );
    return { ...i, unitCostMinor: next };
  });

  if (!changes.length) return done({ changed: 0 });

  await updateSalesOrder(id, { items });
  await addSalesOrderActivity(id, {
    authorId: actor.sub,
    body: `Costs amended (${input.reason}) — ${changes.join("; ")}`,
  });
  return done({ changed: changes.length });
}

export async function recordWithholding(
  id: string,
  input: WithholdingInput,
  actor: Actor,
): Promise<SalesResult<Lean<ISalesOrder>>> {
  const order = await getSalesOrderById(id);
  if (!order) return fail("not_found");
  if (order.status === "draft" || order.status === "proposal_generated") {
    // Nothing has been billed, so there is nothing to withhold against.
    return fail("invalid_transition");
  }

  // A rate is applied to the goods after discount — the same base the invoice
  // prints, so our books and the client's paper never disagree. An explicit
  // amount wins when one is given, because a deduction slip is the fact and
  // the rate is only how it was described.
  const base = aitBaseMinor(order.subtotalMinor, order.discountMinor);
  const rateBp = input.aitRateBp ?? 0;
  const aitMinor =
    input.aitMinor ??
    aitOnGoods(order.subtotalMinor, order.discountMinor, rateBp);
  const aitRateBp =
    input.aitRateBp ?? (base > 0 ? Math.round((aitMinor / base) * 10000) : 0);

  await updateSalesOrder(id, {
    withholding: {
      aitRateBp,
      aitMinor,
      // A person read the client's slip; the invoice must never overwrite it.
      source: "confirmed" as const,
      vdsMinor: input.vdsMinor ?? null,
      certificateReceived: input.certificateReceived ?? false,
      certificateRef: input.certificateRef || null,
      note: input.note || null,
      recordedAt: new Date(),
      recordedBy: actor.sub,
    },
  });
  await addSalesOrderActivity(id, {
    authorId: actor.sub,
    body: `AIT recorded: ${(aitRateBp / 100).toFixed(2)}% withheld${
      input.certificateReceived ? " · certificate received" : ""
    }`,
  });

  const fresh = await getSalesOrderById(id);
  return fresh ? done(fresh) : fail("not_found");
}

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
