"use client";

import { Fragment, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  SalesReport,
  Receivable,
} from "@/lib/repositories/sales-report.repo";
import { SalesSheet } from "@/components/admin/sales/sales-sheet";
import type { SalesSheetLayout } from "@/lib/admin/sales-sheet";

/** Poisha to a plain grouped figure. The heading carries the currency. */
const taka = (minor: number) =>
  (minor / 100).toLocaleString("en-BD", { maximumFractionDigits: 2 });

const pct = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })
    : "—";

function Figure({
  label,
  minor,
  hint,
  tone,
}: {
  label: string;
  minor: number;
  hint?: string;
  tone?: "good" | "warn";
}) {
  return (
    <Card className="gap-1 p-4">
      <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.12em] uppercase">
        {label}
      </span>
      <strong
        className={cn(
          "text-foreground text-xl leading-tight font-bold tabular-nums",
          tone === "good" && "text-[var(--tone-success-fg)]",
          tone === "warn" && "text-[var(--tone-warning-fg)]",
        )}
      >
        ৳{taka(minor)}
      </strong>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </Card>
  );
}

/**
 * The sales report.
 *
 * Two things are kept deliberately apart, because conflating them is the
 * commonest way a report like this misleads:
 *
 *   PROFIT   revenue (goods, ex-VAT) less what those goods cost us.
 *   CASH     what was invoiced, what the buyer withheld, what actually landed.
 *
 * AIT lives in the second and never the first. It is withheld against our own
 * income tax and reclaimed with the certificate, so treating it as a cost
 * would understate profit AND pay for the same tax twice at year end.
 *
 * "After AIT" is the bridge between the two, and is a CASH figure wearing a
 * profit's clothes: net profit less what the buyer kept back, i.e. what is in
 * our hands before the certificate brings the rest home. It is labelled and
 * hinted as cash everywhere it appears precisely because the temptation is to
 * read the smaller number as the truer one. It is not — it is the earlier one.
 */
export function SalesReportView({
  report,
  receivables,
  sheetLayout,
}: {
  report: SalesReport;
  receivables: Receivable[];
  /** The admin's saved spreadsheet arrangement. */
  sheetLayout: SalesSheetLayout;
}) {
  // Two ways to read the same figures. The grouped view is for scanning
  // ("which client made us money"); the spreadsheet is every line on one
  // ruled grid, which is what someone checking the numbers against a folder
  // of invoices actually wants.
  const [view, setView] = useState<"grouped" | "sheet">("grouped");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const t = report.totals;
  const outstanding = useMemo(
    () => receivables.reduce((s, r) => s + r.outstandingMinor, 0),
    [receivables],
  );

  const csv = () => {
    const rows: string[][] = [
      [
        "Client",
        "Reference",
        "Channel",
        "Paid",
        "Item",
        "SKU",
        "Qty",
        "Unit price",
        "Unit cost",
        "Revenue",
        "Cost",
        "Gross profit",
        "AIT withheld",
        "Cash after AIT",
      ],
    ];
    for (const c of report.clients) {
      for (const o of c.orders) {
        for (const [li, l] of o.lines.entries()) {
          rows.push([
            c.name,
            o.ref,
            o.channel,
            day(o.paidAt),
            l.description,
            l.sku ?? "",
            String(l.qty),
            taka(l.unitPriceMinor),
            l.unitCostMinor == null ? "" : taka(l.unitCostMinor),
            taka(l.revenueMinor),
            taka(l.costMinor),
            taka(l.profitMinor),
            // Order-level, so written once against the order's first line:
            // repeating it down the rows would sum to several times the truth.
            li === 0 ? taka(o.aitMinor) : "",
            li === 0 ? taka(o.netCashMinor) : "",
          ]);
        }
      }
    }
    const body = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${report.range.start.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ── profitability ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-admin-lg font-semibold">Profitability</h2>
          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="View"
              className="bg-muted inline-flex rounded-md p-0.5"
            >
              {(["grouped", "sheet"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    view === v
                      ? "bg-background text-foreground shadow-[var(--shadow-sm)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "grouped" ? "By client" : "Spreadsheet"}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={csv}
              className="gap-1.5"
            >
              <Download className="size-4" aria-hidden />
              Export CSV
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Figure
            label="Revenue"
            minor={t.revenueMinor}
            hint="Goods sold, excluding VAT"
          />
          <Figure
            label="Cost of goods"
            minor={t.costMinor}
            hint="What those goods cost us"
          />
          <Figure
            label="Gross profit"
            minor={t.profitMinor}
            hint={`Margin ${pct(t.profitMinor, t.revenueMinor)}`}
            tone="good"
          />
          <Figure
            label="Order costs"
            minor={t.orderCostMinor}
            hint="Delivery, courier, installation"
          />
          {/* The eye lands here, so this card says what actually arrived. A
              reader who stops at "Net profit" must not walk away thinking that
              figure is in the bank when the buyer kept some of it back. */}
          <Figure
            label="Net profit"
            minor={t.netMinor}
            hint={
              t.aitMinor > 0
                ? `After order costs. ${taka(t.aitMinor)} was withheld at source — ${taka(t.netCashMinor)} reached the bank`
                : `After order costs and ${taka(t.expensesMinor)} of client visits`
            }
            tone="good"
          />
        </div>

        {t.linesMissingCost > 0 && (
          <p className="flex items-start gap-2 rounded-md border border-[var(--tone-warning-fg)]/30 bg-[var(--tone-warning)]/10 p-3 text-sm">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-[var(--tone-warning-fg)]"
              aria-hidden
            />
            <span>
              <strong>{t.linesMissingCost}</strong>{" "}
              {t.linesMissingCost === 1 ? "line has" : "lines have"} no cost
              recorded. Those are counted at zero cost, so the margin above is
              flattering until they are filled in.
            </span>
          </p>
        )}
      </section>

      {view === "sheet" && (
        <SalesSheet report={report} initialLayout={sheetLayout} />
      )}

      {/* ── per client ── */}
      {view === "grouped" && (
        <section className="space-y-3">
          <h2 className="text-admin-lg font-semibold">By client</h2>
          <div className="bg-card overflow-x-auto rounded-lg shadow-[var(--shadow-sm)]">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Orders
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Revenue
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cost</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Gross profit
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Margin
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Order costs
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Client costs
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Net profit
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">AIT</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Cash after AIT
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.clients.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="text-muted-foreground px-4 py-8 text-center"
                    >
                      Nothing was paid for in this period.
                    </td>
                  </tr>
                )}
                {report.clients.map((c) => {
                  const isOpen = open.has(c.key);
                  return (
                    <Fragment key={c.key}>
                      <tr className="border-b">
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggle(c.key)}
                            className="text-primary flex items-center gap-1.5 text-left font-medium hover:underline"
                            aria-expanded={isOpen}
                          >
                            {isOpen ? (
                              <ChevronDown
                                className="size-4 shrink-0"
                                aria-hidden
                              />
                            ) : (
                              <ChevronRight
                                className="size-4 shrink-0"
                                aria-hidden
                              />
                            )}
                            {c.name}
                            {c.code && (
                              <span className="text-muted-foreground font-mono text-xs">
                                {c.code}
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {c.orders.length}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {taka(c.revenueMinor)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {taka(c.costMinor)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          {taka(c.profitMinor)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {pct(c.profitMinor, c.revenueMinor)}
                        </td>
                        <td className="text-muted-foreground px-4 py-2.5 text-right tabular-nums">
                          {c.orderCostMinor > 0 ? taka(c.orderCostMinor) : "—"}
                        </td>
                        <td className="text-muted-foreground px-4 py-2.5 text-right tabular-nums">
                          {c.expensesMinor > 0 ? taka(c.expensesMinor) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                          {taka(c.netMinor)}
                        </td>
                        <td className="text-muted-foreground px-4 py-2.5 text-right tabular-nums">
                          {c.aitMinor > 0 ? taka(c.aitMinor) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                          {taka(c.netCashMinor)}
                        </td>
                      </tr>

                      {isOpen &&
                        c.orders.map((o) => (
                          <Fragment key={o.id}>
                            <tr className="bg-muted/30 border-b">
                              <td className="px-4 py-2 pl-10" colSpan={2}>
                                <span className="font-mono text-xs">
                                  {o.ref}
                                </span>
                                {o.invoiceNumber && (
                                  <span className="text-muted-foreground ml-2 font-mono text-xs">
                                    {o.invoiceNumber}
                                  </span>
                                )}
                                <span className="text-muted-foreground ml-2 text-xs">
                                  paid {day(o.paidAt)}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {taka(o.revenueMinor)}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {taka(o.costMinor)}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {taka(o.profitMinor)}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {pct(o.profitMinor, o.revenueMinor)}
                              </td>
                              <td className="text-muted-foreground px-4 py-2 text-right tabular-nums">
                                {o.orderCostMinor > 0
                                  ? taka(o.orderCostMinor)
                                  : "—"}
                              </td>
                              <td className="text-muted-foreground px-4 py-2 text-right text-xs">
                                {o.vatMinor > 0 && <>VAT {taka(o.vatMinor)}</>}
                                {o.aitMinor > 0 && (
                                  <> · AIT {taka(o.aitMinor)}</>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right font-medium tabular-nums">
                                {taka(o.netMinor)}
                              </td>
                              <td className="text-muted-foreground px-4 py-2 text-right tabular-nums">
                                {o.aitMinor > 0 ? taka(o.aitMinor) : "—"}
                              </td>
                              <td className="px-4 py-2 text-right font-medium tabular-nums">
                                {taka(o.netCashMinor)}
                              </td>
                            </tr>
                            {o.lines.map((l, li) => (
                              <tr
                                key={`${o.id}-${li}`}
                                className="text-muted-foreground border-b text-xs"
                              >
                                <td className="px-4 py-1.5 pl-16" colSpan={2}>
                                  {l.description}
                                  {l.sku && (
                                    <span className="ml-2 font-mono">
                                      {l.sku}
                                    </span>
                                  )}
                                  <span className="ml-2">× {l.qty}</span>
                                </td>
                                <td className="px-4 py-1.5 text-right tabular-nums">
                                  {taka(l.revenueMinor)}
                                </td>
                                <td className="px-4 py-1.5 text-right tabular-nums">
                                  {l.unitCostMinor == null ? (
                                    <span className="text-[var(--tone-warning-fg)]">
                                      no cost
                                    </span>
                                  ) : (
                                    taka(l.costMinor)
                                  )}
                                </td>
                                <td className="px-4 py-1.5 text-right tabular-nums">
                                  {taka(l.profitMinor)}
                                </td>
                                <td colSpan={6} />
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── cash, kept apart from profit ── */}
      <section className="space-y-3">
        <h2 className="text-admin-lg font-semibold">Cash and tax</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Figure
            label="VAT collected"
            minor={t.vatMinor}
            hint="Owed to the government, never ours"
          />
          <Figure
            label="AIT withheld"
            minor={t.aitMinor}
            hint="Reclaimable against income tax — an asset, not a cost"
          />
          <Figure
            label="Cash after AIT"
            minor={t.netCashMinor}
            hint={
              t.aitMinor > 0
                ? "Net profit less what was withheld — the rest returns with the certificate"
                : "Nothing withheld, so the same as net profit"
            }
          />
          <Figure
            label="Transport billed"
            minor={t.deliveryMinor}
            hint="Charged on top of goods"
          />
          <Figure
            label="Outstanding"
            minor={outstanding}
            hint={`${receivables.length} invoice${receivables.length === 1 ? "" : "s"} unpaid`}
            tone="warn"
          />
        </div>

        {receivables.length > 0 && (
          <div className="bg-card overflow-x-auto rounded-lg shadow-[var(--shadow-sm)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Invoice</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Total
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Outstanding
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold">Age</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="px-4 py-2.5">{r.client}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {r.invoiceNumber ?? r.ref}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {taka(r.totalMinor)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {taka(r.outstandingMinor)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right tabular-nums",
                        r.daysOutstanding > 45 &&
                          "font-semibold text-[var(--tone-danger-fg)]",
                      )}
                    >
                      {r.daysOutstanding} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
