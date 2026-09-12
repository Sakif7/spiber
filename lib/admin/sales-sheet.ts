import type { SalesReport } from "@/lib/repositories/sales-report.repo";

/**
 * How the sales spreadsheet is laid out, and how a report is folded into it.
 *
 * Pure and framework-free: the same rules run in the table, in the CSV export
 * and in the unit tests, so what you export is what you were looking at.
 *
 * The default deliberately groups by invoice. Every line of an invoice repeats
 * the same client, reference and date, and printing those on every row turns a
 * readable document into a wall — so they are written once, on the first line
 * of each group, exactly as they would appear on paper.
 */

export type SheetColumnKey =
  | "client"
  | "reference"
  | "paid"
  | "channel"
  | "item"
  | "sku"
  | "qty"
  | "unitPrice"
  | "unitCost"
  | "revenue"
  | "cost"
  | "profit"
  | "margin"
  | "orderCosts"
  | "clientCosts"
  | "ait"
  | "netCash";

export type SheetColumn = {
  key: SheetColumnKey;
  label: string;
  align: "left" | "right";
  /** Money columns are summed into subtotals; text columns are not. */
  kind: "text" | "mono" | "money" | "number" | "percent";
  /** Repeats within a group are written once (client, reference, date). */
  groupable?: boolean;
};

export const SHEET_COLUMNS: SheetColumn[] = [
  {
    key: "client",
    label: "Client",
    align: "left",
    kind: "text",
    groupable: true,
  },
  {
    key: "reference",
    label: "Reference",
    align: "left",
    kind: "mono",
    groupable: true,
  },
  { key: "paid", label: "Paid", align: "left", kind: "text", groupable: true },
  {
    key: "channel",
    label: "Channel",
    align: "left",
    kind: "text",
    groupable: true,
  },
  { key: "item", label: "Item", align: "left", kind: "text" },
  { key: "sku", label: "SKU", align: "left", kind: "mono" },
  { key: "qty", label: "Qty", align: "right", kind: "number" },
  { key: "unitPrice", label: "Unit price", align: "right", kind: "money" },
  { key: "unitCost", label: "Unit cost", align: "right", kind: "money" },
  { key: "revenue", label: "Revenue", align: "right", kind: "money" },
  { key: "cost", label: "Cost", align: "right", kind: "money" },
  { key: "profit", label: "Gross profit", align: "right", kind: "money" },
  { key: "margin", label: "Margin", align: "right", kind: "percent" },
  { key: "orderCosts", label: "Order costs", align: "right", kind: "money" },
  { key: "clientCosts", label: "Client costs", align: "right", kind: "money" },
  { key: "ait", label: "AIT withheld", align: "right", kind: "money" },
  { key: "netCash", label: "After AIT", align: "right", kind: "money" },
];

const BY_KEY = new Map(SHEET_COLUMNS.map((c) => [c.key, c]));

/** Only these are added up; the rest are blank on a subtotal row. */
const SUMMED: SheetColumnKey[] = [
  "qty",
  "revenue",
  "cost",
  "profit",
  "orderCosts",
  "clientCosts",
  "ait",
  "netCash",
];

/**
 * Figures that belong to the ORDER, not to any line on it.
 *
 * AIT is withheld on the bill as a whole and order costs are carried by the
 * job, so there is no honest way to split either across lines — dividing by
 * line count would invent a number and repeating it on every row would sum to
 * several times the truth. They are therefore blank on line rows and appear
 * only where the arithmetic is real: the subtotal and the total.
 */
const ORDER_LEVEL: SheetColumnKey[] = [
  "orderCosts",
  "clientCosts",
  "ait",
  "netCash",
];

export type SalesSheetLayout = {
  /** Visible columns, in the order they are shown. */
  columns: SheetColumnKey[];
  /** What a run of rows shares. Repeats inside a group are written once. */
  groupBy: "invoice" | "client" | "none";
  /** A totals line under each client. */
  clientSubtotals: boolean;
};

export const DEFAULT_SHEET_LAYOUT: SalesSheetLayout = {
  columns: [
    "client",
    "reference",
    "paid",
    "item",
    "sku",
    "qty",
    "unitPrice",
    "unitCost",
    "revenue",
    "cost",
    "profit",
    "orderCosts",
    "clientCosts",
    "ait",
    "netCash",
  ],
  groupBy: "invoice",
  clientSubtotals: true,
};

/**
 * Coerce anything stored or sent into a usable layout.
 *
 * A saved layout outlives the code that wrote it, so an unknown column is
 * dropped rather than rendered as an empty stripe, and an empty selection
 * falls back to the default instead of showing a table with no columns.
 */
export function sanitizeSheetLayout(raw: unknown): SalesSheetLayout {
  const r = (raw ?? {}) as Partial<SalesSheetLayout>;
  const seen = new Set<SheetColumnKey>();
  const columns = (Array.isArray(r.columns) ? r.columns : [])
    .filter((k): k is SheetColumnKey => BY_KEY.has(k as SheetColumnKey))
    .filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
  return {
    columns: columns.length ? columns : DEFAULT_SHEET_LAYOUT.columns,
    groupBy:
      r.groupBy === "client" || r.groupBy === "none" || r.groupBy === "invoice"
        ? r.groupBy
        : DEFAULT_SHEET_LAYOUT.groupBy,
    clientSubtotals:
      typeof r.clientSubtotals === "boolean"
        ? r.clientSubtotals
        : DEFAULT_SHEET_LAYOUT.clientSubtotals,
  };
}

export type SheetCell = { key: SheetColumnKey; value: string | number | null };

export type SheetRow =
  | {
      kind: "line";
      /** Cells whose value repeats the row above within the same group. */
      repeated: SheetColumnKey[];
      values: Record<SheetColumnKey, string | number | null>;
    }
  | {
      kind: "subtotal" | "total";
      label: string;
      values: Partial<Record<SheetColumnKey, number>>;
    };

const marginOf = (profit: number, revenue: number) =>
  revenue > 0 ? (profit / revenue) * 100 : null;

/**
 * Fold a report into rows for the sheet.
 *
 * Money stays in poisha here; formatting is the table's job, so the CSV and
 * the screen can present the same numbers differently without either one
 * rounding twice.
 */
export function buildSheet(
  report: SalesReport,
  layout: SalesSheetLayout,
): SheetRow[] {
  const rows: SheetRow[] = [];

  for (const client of report.clients) {
    let lastGroup: string | null = null;
    let firstOfClient = true;

    for (const order of client.orders) {
      for (const [i, line] of order.lines.entries()) {
        const groupKey =
          layout.groupBy === "invoice"
            ? order.id
            : layout.groupBy === "client"
              ? client.key
              : `${order.id}:${i}`;

        const values: Record<SheetColumnKey, string | number | null> = {
          client: client.name,
          reference: order.invoiceNumber ?? order.ref,
          paid: order.paidAt,
          channel: order.channel === "online" ? "Online" : "Sales team",
          item: line.description,
          sku: line.sku,
          qty: line.qty,
          unitPrice: line.unitPriceMinor,
          unitCost: line.unitCostMinor,
          revenue: line.revenueMinor,
          cost: line.costMinor,
          profit: line.profitMinor,
          margin: marginOf(line.profitMinor, line.revenueMinor),
          // Order-level: carried by the bill, not by this line. See ORDER_LEVEL.
          orderCosts: null,
          clientCosts: null,
          ait: null,
          netCash: null,
        };

        // Inside a group the shared cells are written once. Across groups they
        // start again, which is what makes each invoice read as a block.
        const sameGroup = groupKey === lastGroup;
        const repeated =
          layout.groupBy === "none"
            ? []
            : SHEET_COLUMNS.filter(
                (c) =>
                  c.groupable &&
                  sameGroup &&
                  // The client only repeats when it is also not the first of
                  // its own run, which it always is inside one group.
                  !(c.key === "client" && firstOfClient),
              ).map((c) => c.key);

        rows.push({ kind: "line", repeated, values });
        lastGroup = groupKey;
        firstOfClient = false;
      }
    }

    if (layout.clientSubtotals && client.orders.length) {
      rows.push({
        kind: "subtotal",
        label: `${client.name} total`,
        values: {
          qty: client.orders.reduce(
            (t, o) => t + o.lines.reduce((s, l) => s + l.qty, 0),
            0,
          ),
          revenue: client.revenueMinor,
          cost: client.costMinor,
          profit: client.profitMinor,
          margin:
            marginOf(client.profitMinor, client.revenueMinor) ?? undefined,
          orderCosts: client.orderCostMinor,
          clientCosts: client.expensesMinor,
          ait: client.aitMinor,
          netCash: client.netCashMinor,
        },
      });
    }
  }

  if (rows.length) {
    const t = report.totals;
    rows.push({
      kind: "total",
      label: "Total",
      values: {
        qty: report.clients.reduce(
          (a, c) =>
            a +
            c.orders.reduce(
              (t2, o) => t2 + o.lines.reduce((s, l) => s + l.qty, 0),
              0,
            ),
          0,
        ),
        revenue: t.revenueMinor,
        cost: t.costMinor,
        profit: t.profitMinor,
        margin: marginOf(t.profitMinor, t.revenueMinor) ?? undefined,
        orderCosts: t.orderCostMinor,
        clientCosts: t.expensesMinor,
        ait: t.aitMinor,
        netCash: t.netCashMinor,
      },
    });
  }

  return rows;
}

/** Which of the visible columns carry a figure on a subtotal line. */
export function isSummed(key: SheetColumnKey): boolean {
  return SUMMED.includes(key) || key === "margin";
}

/** True for a column that only carries a figure on a subtotal or total row. */
export function isOrderLevel(key: SheetColumnKey): boolean {
  return ORDER_LEVEL.includes(key);
}

export function columnsFor(layout: SalesSheetLayout): SheetColumn[] {
  return layout.columns
    .map((k) => BY_KEY.get(k))
    .filter((c): c is SheetColumn => Boolean(c));
}
