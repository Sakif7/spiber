import { connectToDatabase } from "@/lib/db/connect";
import { Order } from "@/lib/models/order";
import { SalesOrder } from "@/lib/models/salesOrder";
import { Expense, type IExpense } from "@/lib/models/expense";
import { Visit } from "@/lib/models/visit";
import { PaymentAttempt } from "@/lib/models/payment-attempt";
import type { Lean } from "@/lib/models/_shared";
import { expenseLinesOf } from "@/lib/hr/expense-lines";

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
  /**
   * A cost line, not a sale (the fees PayStation kept on payments that were
   * returned). Listed with the orders so the cost is visible; never counted
   * as an order.
   */
  adjustment?: boolean;
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
  /**
   * Net profit less the AIT the buyer kept back.
   *
   * The cash view of the same job: what is actually in our hands today, before
   * the withheld tax comes back with the certificate. Deliberately NOT profit —
   * see the note on `SalesReportView` — and kept as a separate figure so one
   * never quietly becomes the other.
   */
  netCashMinor: number;
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
  /** That net, less AIT withheld: the cash side. Never profit. */
  netCashMinor: number;
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
    netCashMinor: number;
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
      netCashMinor:
        revenueMinor -
        costMinor -
        orderCostMinor -
        num(o.withholding?.aitMinor),
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

  // What the gateway charged us on each order paid online. The company bears
  // the fee (2026-10-28), so it is a cost of the sale, frozen on the payment.
  const fees = new Map<string, number>();
  if (docs.length) {
    const paid = await PaymentAttempt.find({
      "subject.kind": { $in: ["order", "order_due"] },
      "subject.id": { $in: docs.map((d: Record<string, any>) => d._id) },
      status: "paid",
    })
      .select({ "subject.id": 1, feeMinor: 1 })
      .lean()
      .exec();
    for (const a of paid as Record<string, any>[]) {
      const k = String(a.subject?.id);
      fees.set(k, (fees.get(k) ?? 0) + num(a.feeMinor));
    }
  }

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
    // A storefront order carries its shipping as revenue, not as a cost to
    // us. What it does cost: the gateway's fee, and the poisha dropped to make
    // the total whole taka — both money that never reaches the bank.
    const orderCosts: { label: string; amountMinor: number }[] = [];
    const fee = fees.get(String(o._id)) ?? 0;
    if (fee > 0) orderCosts.push({ label: "Payment fee", amountMinor: fee });
    const rounding = -num(o.roundingMinor);
    if (rounding > 0)
      orderCosts.push({ label: "Rounding", amountMinor: rounding });
    const orderCostMinor = orderCosts.reduce((t, c) => t + c.amountMinor, 0);

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
      orderCostMinor,
      orderCosts,
      netMinor: revenueMinor - costMinor - orderCostMinor,
      netCashMinor: revenueMinor - costMinor - orderCostMinor,
      linesMissingCost: lines.filter((l) => l.unitCostMinor == null).length,
      lines,
    };
  });
}

/**
 * Fees on money taken online and then returned (or waiting to be): the
 * payment is no longer revenue, but PayStation kept its fee, so it stays a
 * cost in the period the money was taken. One line, not one per payment.
 */
async function feesOnReturnedPayments(
  range: ReportRange,
): Promise<ReportOrder | null> {
  const rows = await PaymentAttempt.find({
    status: { $in: ["needs_refund", "refunded"] },
    paidAt: { $gte: range.start, $lt: range.end },
  })
    .select({ feeMinor: 1 })
    .lean()
    .exec();
  const fee = (rows as Record<string, any>[]).reduce(
    (t, a) => t + num(a.feeMinor),
    0,
  );
  if (fee <= 0) return null;
  return {
    id: "online-returned-fees",
    adjustment: true,
    ref: `Fees on ${rows.length} returned payment${rows.length === 1 ? "" : "s"}`,
    channel: "online",
    invoiceNumber: null,
    paidAt: null,
    revenueMinor: 0,
    costMinor: 0,
    profitMinor: 0,
    vatMinor: 0,
    deliveryMinor: 0,
    aitMinor: 0,
    orderCostMinor: fee,
    orderCosts: [{ label: "Payment fee (money returned)", amountMinor: fee }],
    netMinor: -fee,
    netCashMinor: -fee,
    linesMissingCost: 0,
    lines: [],
  };
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
 *
 * A claim is a bill whose lines can fall on different days, so each line is
 * counted in the period its own day falls in — a trip from the 30th to the
 * 2nd costs each month what was spent in it.
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

  const within = { $gte: range.start, $lt: range.end };
  const expenses = await Expense.find({
    deletedAt: null,
    status: { $in: ["approved", "reimbursed"] },
    visitId: { $in: visits.map((v: Record<string, any>) => v._id) },
    $or: [{ spentAt: within }, { "lines.spentAt": within }],
  })
    .select("visitId amountMinor spentAt category lines")
    .lean<Lean<IExpense>[]>()
    .exec();

  for (const e of expenses) {
    const lead = leadByVisit.get(String(e.visitId));
    if (!lead) continue;
    for (const line of expenseLinesOf(e)) {
      const at = new Date(line.spentAt);
      if (at < range.start || at >= range.end) continue;
      out.set(lead, (out.get(lead) ?? 0) + num(line.amountMinor));
    }
  }
  return out;
}

/* ── the report ─────────────────────────────────────────────────────────── */

export async function salesReport(range: ReportRange): Promise<SalesReport> {
  await connectToDatabase();

  const [offline, onlineSold, returnedFees, expenses] = await Promise.all([
    offlineOrders(range),
    onlineOrders(range),
    feesOnReturnedPayments(range),
    attributedExpenses(range),
  ]);
  const online = returnedFees ? [...onlineSold, returnedFees] : onlineSold;

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
        netCashMinor: 0,
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
    c.netCashMinor = c.netMinor - c.aitMinor;
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
      // The returned-payment fees line is a cost, not an order.
      t.orders += c.orders.filter((o) => !o.adjustment).length;
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
      netCashMinor: 0,
      orders: 0,
      linesMissingCost: 0,
    },
  );
  totals.netMinor =
    totals.profitMinor - totals.orderCostMinor - totals.expensesMinor;
  totals.netCashMinor = totals.netMinor - totals.aitMinor;

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
  /**
   * When the goods went out: the day the order was marked delivered, or the
   * delivery date written on the invoice while it is still on its way. Null
   * until either is known — an accounts manager chasing a bill wants to know
   * whether the client even has the goods yet.
   */
  deliveredAt: string | null;
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
      const promised = o.invoices?.length
        ? o.invoices[o.invoices.length - 1].snapshot?.deliveryDate
        : null;
      const deliveredAt = o.deliveredAt
        ? new Date(o.deliveredAt)
        : promised
          ? new Date(promised)
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
        deliveredAt: deliveredAt ? deliveredAt.toISOString() : null,
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
