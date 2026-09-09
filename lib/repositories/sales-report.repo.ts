import { connectToDatabase } from "@/lib/db/connect";
import { Order } from "@/lib/models/order";
import { SalesOrder } from "@/lib/models/salesOrder";
import { Expense } from "@/lib/models/expense";
import { Visit } from "@/lib/models/visit";

/**
 * The sales report: what we sold, what it cost us, and what we kept.
 *
 * Both halves of the business are read here — the storefronts and the sales
 * team — and reduced to the same shape, because "how did we do" is one
 * question and the answer should not depend on which door the money came
 * through.
 *
 * Money is counted when it was PAID, matching `revenue.repo` and payroll, so
 * the report and the dashboard can never disagree about the size of a month.
 * An invoice raised but not yet collected is therefore absent from profit —
 * which is correct, and is why `receivables()` exists to show it separately.
 *
 * Three deliberate choices an auditor will ask about:
 *
 *  - VAT is excluded from revenue. It is the government's money passing
 *    through us, never ours to book as income.
 *  - COST IS READ OFF THE SALE, never off the product today. Every line froze
 *    what it cost at the moment it sold, so re-running a past month reproduces
 *    the same number no matter how prices have moved since.
 *  - A line with NO cost recorded is not treated as free. It is excluded from
 *    cost and counted in `linesMissingCost`, so a margin that looks too good
 *    announces why instead of quietly lying.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- every read below is a
   lean Mongoose document whose generated type varies per model and per select.
   Each field is named explicitly and coerced through `num()`, and the shape
   that leaves this file is fixed by the exported return types. */

export type ReportRange = { start: Date; end: Date };

export type ReportLine = {
  description: string;
  sku: string | null;
  qty: number;
  unitPriceMinor: number;
  unitCostMinor: number | null;
  revenueMinor: number;
  costMinor: number;
  profitMinor: number;
};

export type ReportOrder = {
  id: string;
  ref: string;
  /** "offline" = raised by the sales team; "online" = a storefront order. */
  channel: "offline" | "online";
  invoiceNumber: string | null;
  paidAt: string | null;
  /** Goods, after discount and before VAT. */
  revenueMinor: number;
  costMinor: number;
  profitMinor: number;
  vatMinor: number;
  deliveryMinor: number;
  /** Withheld by the buyer against our tax, not a cost. */
  aitMinor: number;
  /** Delivery, courier, installation — real money this sale cost us. */
  orderCostMinor: number;
  orderCosts: { label: string; amountMinor: number }[];
  /** Gross profit less those costs: what the job actually made. */
  netMinor: number;
  linesMissingCost: number;
  lines: ReportLine[];
};

export type ReportClient = {
  key: string;
  name: string;
  code: string | null;
  channel: "offline" | "online";
  orders: ReportOrder[];
  revenueMinor: number;
  costMinor: number;
  profitMinor: number;
  vatMinor: number;
  aitMinor: number;
  /** Delivery, courier and the like, summed across this client's orders. */
  orderCostMinor: number;
  /** Costs booked against this client's visits — see `attributedExpenses`. */
  expensesMinor: number;
  /** Gross profit less order costs and the visits spent winning them. */
  netMinor: number;
  linesMissingCost: number;
};

export type SalesReport = {
  range: { start: string; end: string };
  clients: ReportClient[];
  totals: {
    revenueMinor: number;
    costMinor: number;
    profitMinor: number;
    vatMinor: number;
    deliveryMinor: number;
    aitMinor: number;
    orderCostMinor: number;
    expensesMinor: number;
    netMinor: number;
    orders: number;
    linesMissingCost: number;
  };
};

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);

/** Goods sold, after discount, before VAT — the only figure that is ours. */
const netGoods = (subtotal: unknown, discount: unknown) =>
  Math.max(0, num(subtotal) - num(discount));

/* ── offline: the sales team ────────────────────────────────────────────── */

async function offlineOrders(range: ReportRange): Promise<ReportOrder[]> {
  const docs = await SalesOrder.find({
    deletedAt: null,
    status: { $nin: ["cancelled"] },
    "payment.status": "paid",
    "payment.paidAt": { $gte: range.start, $lt: range.end },
  })
    .lean()
    .exec();

  return docs.map((o: Record<string, any>) => {
    const lines: ReportLine[] = (o.items ?? []).map(
      (i: Record<string, any>) => {
        const qty = num(i.qty);
        const revenueMinor = num(i.lineTotalMinor);
        const hasCost = i.unitCostMinor != null;
        const costMinor = hasCost ? num(i.unitCostMinor) * qty : 0;
        return {
          description: i.description ?? "",
          sku: i.sku ?? null,
          qty,
          unitPriceMinor: num(i.unitPriceMinor),
          unitCostMinor: hasCost ? num(i.unitCostMinor) : null,
          revenueMinor,
          costMinor,
          profitMinor: revenueMinor - costMinor,
        };
      },
    );

    // The discount is taken off the whole order, so it belongs to the order,
    // not to any one line: line revenue sums to the gross, and the order's
    // revenue is that gross less the discount.
    const revenueMinor = netGoods(o.subtotalMinor, o.discountMinor);
    const costMinor = lines.reduce((s, l) => s + l.costMinor, 0);
    const orderCostMinor = (o.costs ?? []).reduce(
      (t: number, c: Record<string, any>) => t + num(c.amountMinor),
      0,
    );

    return {
      id: String(o._id),
      ref: o.number ?? String(o._id),
      channel: "offline" as const,
      invoiceNumber: o.invoiceNumber ?? null,
      paidAt: o.payment?.paidAt
        ? new Date(o.payment.paidAt).toISOString()
        : null,
      revenueMinor,
      costMinor,
      profitMinor: revenueMinor - costMinor,
      vatMinor: num(o.vatMinor),
      deliveryMinor: num(o.deliveryMinor),
      aitMinor: num(o.withholding?.aitMinor),
      orderCostMinor,
      orderCosts: (o.costs ?? []).map((c: Record<string, any>) => ({
        label: c.label ?? "Cost",
        amountMinor: num(c.amountMinor),
      })),
      netMinor: revenueMinor - costMinor - orderCostMinor,
      linesMissingCost: lines.filter((l) => l.unitCostMinor == null).length,
      lines,
    };
  });
}

/* ── online: the storefronts ────────────────────────────────────────────── */

async function onlineOrders(range: ReportRange): Promise<ReportOrder[]> {
  const docs = await Order.find({
    deletedAt: null,
    status: { $nin: ["cancelled", "refunded"] },
    "payment.status": "paid",
    "payment.paidAt": { $gte: range.start, $lt: range.end },
  })
    .lean()
    .exec();

  return docs.map((o: Record<string, any>) => {
    const lines: ReportLine[] = (o.items ?? []).map(
      (i: Record<string, any>) => {
        const qty = num(i.qty);
        const revenueMinor = num(i.lineTotalMinor);
        const snap = i.productSnapshot ?? {};
        const hasCost = snap.costPriceMinor != null;
        const costMinor = hasCost ? num(snap.costPriceMinor) * qty : 0;
        return {
          description: snap.name?.en ?? snap.sku ?? "Item",
          sku: snap.sku ?? null,
          qty,
          unitPriceMinor: num(snap.priceMinor),
          unitCostMinor: hasCost ? num(snap.costPriceMinor) : null,
          revenueMinor,
          costMinor,
          profitMinor: revenueMinor - costMinor,
        };
      },
    );

    const revenueMinor = netGoods(o.subtotalMinor, o.discountMinor);
    const costMinor = lines.reduce((s, l) => s + l.costMinor, 0);

    return {
      id: String(o._id),
      ref: o.orderNumber ?? String(o._id),
      channel: "online" as const,
      invoiceNumber: null,
      paidAt: o.payment?.paidAt
        ? new Date(o.payment.paidAt).toISOString()
        : null,
      revenueMinor,
      costMinor,
      profitMinor: revenueMinor - costMinor,
      vatMinor: num(o.taxMinor),
      deliveryMinor: num(o.shippingMinor),
      aitMinor: 0,
      // A storefront order carries its shipping as revenue, not as a cost to
      // us; there is nowhere to enter one, so the field is honestly zero.
      orderCostMinor: 0,
      orderCosts: [],
      netMinor: revenueMinor - costMinor,
      linesMissingCost: lines.filter((l) => l.unitCostMinor == null).length,
      lines,
    };
  });
}

/* ── what we spent chasing each client ──────────────────────────────────── */

/**
 * Approved costs that can be traced to a client.
 *
 * An expense is claimed against a visit, and a visit can name the lead it was
 * for — so the fuel and the lunches spent winning a hospital can be set
 * against what that hospital actually earned us. Anything not tied to a visit,
 * or to a visit with no lead, is genuinely general overhead and is left out of
 * a per-client figure rather than being spread arbitrarily.
 */
async function attributedExpenses(
  range: ReportRange,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const visits = await Visit.find({ leadId: { $ne: null } })
    .select("_id leadId")
    .lean()
    .exec();
  if (!visits.length) return out;

  const leadByVisit = new Map(
    visits.map((v: Record<string, any>) => [String(v._id), String(v.leadId)]),
  );

  const expenses = await Expense.find({
    deletedAt: null,
    status: { $in: ["approved", "reimbursed"] },
    visitId: { $in: visits.map((v: Record<string, any>) => v._id) },
    spentAt: { $gte: range.start, $lt: range.end },
  })
    .select("visitId amountMinor")
    .lean()
    .exec();

  for (const e of expenses as Record<string, any>[]) {
    const lead = leadByVisit.get(String(e.visitId));
    if (!lead) continue;
    out.set(lead, (out.get(lead) ?? 0) + num(e.amountMinor));
  }
  return out;
}

/* ── the report ─────────────────────────────────────────────────────────── */

export async function salesReport(range: ReportRange): Promise<SalesReport> {
  await connectToDatabase();

  const [offline, online, expenses] = await Promise.all([
    offlineOrders(range),
    onlineOrders(range),
    attributedExpenses(range),
  ]);

  // Offline sales group by the client they were raised for; the storefronts
  // have no client, so they are one row of their own rather than hundreds of
  // one-order "clients".
  const leadIds = new Set<string>();
  const docs = await SalesOrder.find({
    deletedAt: null,
    "payment.status": "paid",
    "payment.paidAt": { $gte: range.start, $lt: range.end },
  })
    .select("_id leadId leadSnapshot")
    .lean()
    .exec();
  const meta = new Map(
    (docs as Record<string, any>[]).map((d) => {
      if (d.leadId) leadIds.add(String(d.leadId));
      return [
        String(d._id),
        {
          leadId: d.leadId ? String(d.leadId) : null,
          organisation: d.leadSnapshot?.organisation ?? "Unknown client",
          code: d.leadSnapshot?.code ?? null,
        },
      ];
    }),
  );

  const clients = new Map<string, ReportClient>();
  const client = (
    key: string,
    name: string,
    code: string | null,
    channel: "offline" | "online",
  ) => {
    let c = clients.get(key);
    if (!c) {
      c = {
        key,
        name,
        code,
        channel,
        orders: [],
        revenueMinor: 0,
        costMinor: 0,
        profitMinor: 0,
        vatMinor: 0,
        aitMinor: 0,
        orderCostMinor: 0,
        expensesMinor: 0,
        netMinor: 0,
        linesMissingCost: 0,
      };
      clients.set(key, c);
    }
    return c;
  };

  for (const o of offline) {
    const m = meta.get(o.id);
    const key = m?.leadId ?? `so:${o.id}`;
    const c = client(
      key,
      m?.organisation ?? "Unknown client",
      m?.code ?? null,
      "offline",
    );
    c.orders.push(o);
  }
  for (const o of online) {
    const c = client("online", "Online storefronts", null, "online");
    c.orders.push(o);
  }

  for (const c of clients.values()) {
    for (const o of c.orders) {
      c.revenueMinor += o.revenueMinor;
      c.costMinor += o.costMinor;
      c.profitMinor += o.profitMinor;
      c.vatMinor += o.vatMinor;
      c.aitMinor += o.aitMinor;
      c.orderCostMinor += o.orderCostMinor;
      c.linesMissingCost += o.linesMissingCost;
    }
    c.expensesMinor = expenses.get(c.key) ?? 0;
    c.netMinor = c.profitMinor - c.orderCostMinor - c.expensesMinor;
    c.orders.sort((a, b) => (a.paidAt ?? "").localeCompare(b.paidAt ?? ""));
  }

  const list = [...clients.values()].sort(
    (a, b) => b.revenueMinor - a.revenueMinor,
  );

  const totals = list.reduce(
    (t, c) => {
      t.revenueMinor += c.revenueMinor;
      t.costMinor += c.costMinor;
      t.profitMinor += c.profitMinor;
      t.vatMinor += c.vatMinor;
      t.aitMinor += c.aitMinor;
      t.orderCostMinor += c.orderCostMinor;
      t.expensesMinor += c.expensesMinor;
      t.orders += c.orders.length;
      t.linesMissingCost += c.linesMissingCost;
      t.deliveryMinor += c.orders.reduce((s, o) => s + o.deliveryMinor, 0);
      return t;
    },
    {
      revenueMinor: 0,
      costMinor: 0,
      profitMinor: 0,
      vatMinor: 0,
      deliveryMinor: 0,
      aitMinor: 0,
      orderCostMinor: 0,
      expensesMinor: 0,
      netMinor: 0,
      orders: 0,
      linesMissingCost: 0,
    },
  );
  totals.netMinor =
    totals.profitMinor - totals.orderCostMinor - totals.expensesMinor;

  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    clients: list,
    totals,
  };
}

/* ── invoiced but not collected ─────────────────────────────────────────── */

export type Receivable = {
  id: string;
  ref: string;
  invoiceNumber: string | null;
  client: string;
  totalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  invoicedAt: string | null;
  daysOutstanding: number;
};

/**
 * What has been billed and not yet collected.
 *
 * The report counts money when it lands, which is right — but it would
 * otherwise say nothing at all about an invoice sent in March and still
 * unpaid in May. This is that list, and it is the one an accounts manager
 * works from.
 */
export async function receivables(asOf = new Date()): Promise<Receivable[]> {
  await connectToDatabase();
  const docs = await SalesOrder.find({
    deletedAt: null,
    status: { $in: ["invoiced", "delivered"] },
    "payment.status": { $ne: "paid" },
  })
    .lean()
    .exec();

  return (docs as Record<string, any>[])
    .map((o) => {
      const total = num(o.totalMinor);
      const paid = num(o.payment?.paidMinor);
      const invoicedAt = o.invoices?.length
        ? new Date(o.invoices[o.invoices.length - 1].generatedAt)
        : o.createdAt
          ? new Date(o.createdAt)
          : null;
      return {
        id: String(o._id),
        ref: o.number ?? String(o._id),
        invoiceNumber: o.invoiceNumber ?? null,
        client: o.leadSnapshot?.organisation ?? "Unknown client",
        totalMinor: total,
        paidMinor: paid,
        outstandingMinor: Math.max(0, total - paid),
        invoicedAt: invoicedAt ? invoicedAt.toISOString() : null,
        daysOutstanding: invoicedAt
          ? Math.max(
              0,
              Math.floor((asOf.getTime() - invoicedAt.getTime()) / 86400000),
            )
          : 0,
      };
    })
    .filter((r) => r.outstandingMinor > 0)
    .sort((a, b) => b.daysOutstanding - a.daysOutstanding);
}
