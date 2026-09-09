"use client";

import { useMemo, useState } from "react";
import { Columns3, Download, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SalesReport } from "@/lib/repositories/sales-report.repo";
import {
  SHEET_COLUMNS,
  buildSheet,
  columnsFor,
  DEFAULT_SHEET_LAYOUT,
  type SalesSheetLayout,
  type SheetColumnKey,
} from "@/lib/admin/sales-sheet";

const taka = (minor: number) =>
  (minor / 100).toLocaleString("en-BD", { maximumFractionDigits: 2 });

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" });

/**
 * The spreadsheet: every line on one ruled grid, arranged how the admin wants
 * it and remembered for next time.
 *
 * The arrangement is saved against the admin rather than the browser, so an
 * accounts manager sets their columns once and finds them again on the office
 * desktop. Saving is best-effort: the sheet redraws immediately and a failed
 * save costs the preference, never the view.
 */
export function SalesSheet({
  report,
  initialLayout,
}: {
  report: SalesReport;
  initialLayout: SalesSheetLayout;
}) {
  const [layout, setLayout] = useState<SalesSheetLayout>(initialLayout);
  const columns = useMemo(() => columnsFor(layout), [layout]);
  const rows = useMemo(() => buildSheet(report, layout), [report, layout]);

  function apply(next: SalesSheetLayout) {
    setLayout(next);
    void fetch("/api/admin/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salesSheet: next }),
    }).catch(() => {
      // A lost preference is not worth interrupting anyone over.
    });
  }

  const toggleColumn = (key: SheetColumnKey) =>
    apply({
      ...layout,
      columns: layout.columns.includes(key)
        ? layout.columns.filter((k) => k !== key)
        : // Re-inserted in the canonical order, so the sheet never ends up
          // with Revenue sitting to the left of Item.
          SHEET_COLUMNS.filter(
            (c) => c.key === key || layout.columns.includes(c.key),
          ).map((c) => c.key),
    });

  /** What is on screen, in the order it is on screen. */
  const csv = () => {
    const out: string[][] = [columns.map((c) => c.label)];
    for (const r of rows) {
      if (r.kind === "line") {
        out.push(
          columns.map((c) => {
            const v = r.values[c.key];
            if (v == null) return "";
            if (c.kind === "money" || c.kind === "percent")
              return typeof v === "number"
                ? c.kind === "money"
                  ? taka(v)
                  : v.toFixed(1)
                : String(v);
            if (c.key === "paid") return day(String(v));
            return String(v);
          }),
        );
      } else {
        out.push(
          columns.map((c, i) => {
            if (i === 0) return r.label;
            const v = r.values[c.key];
            if (v == null) return "";
            return c.kind === "percent" ? v.toFixed(1) : taka(v);
          }),
        );
      }
    }
    const body = out
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${report.range.start.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cell = (
    c: (typeof columns)[number],
    value: string | number | null,
    hidden: boolean,
  ) => {
    if (hidden || value == null) return "";
    if (c.key === "paid") return day(String(value));
    if (c.kind === "money") return taka(Number(value));
    if (c.kind === "percent") return `${Number(value).toFixed(1)}%`;
    return String(value);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-admin-lg font-semibold">Every line</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
            Group
            <select
              value={layout.groupBy}
              onChange={(e) =>
                apply({
                  ...layout,
                  groupBy: e.target.value as SalesSheetLayout["groupBy"],
                })
              }
              className="border-input bg-background h-8 rounded-md border px-2 text-xs"
            >
              <option value="invoice">By invoice</option>
              <option value="client">By client</option>
              <option value="none">Repeat every cell</option>
            </select>
          </label>

          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={layout.clientSubtotals}
              onChange={(e) =>
                apply({ ...layout, clientSubtotals: e.target.checked })
              }
            />
            Client totals
          </label>

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Columns3 className="size-4" aria-hidden />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              {SHEET_COLUMNS.map((c) => {
                const on = layout.columns.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleColumn(c.key)}
                    aria-pressed={on}
                    className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
                  >
                    <Check
                      className={cn("size-4", !on && "opacity-0")}
                      aria-hidden
                    />
                    {c.label}
                  </button>
                );
              })}
              <div className="border-t p-1 pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={() => apply(DEFAULT_SHEET_LAYOUT)}
                >
                  Reset to default
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button size="sm" variant="outline" onClick={csv} className="gap-1.5">
            <Download className="size-4" aria-hidden />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="bg-card overflow-x-auto rounded-lg shadow-[var(--shadow-sm)]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/60">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "border px-2 py-1.5 font-semibold whitespace-nowrap",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-muted-foreground border px-2 py-8 text-center"
                >
                  Nothing was paid for in this period.
                </td>
              </tr>
            )}
            {rows.map((r, i) =>
              r.kind === "line" ? (
                <tr key={i} className="hover:bg-muted/30">
                  {columns.map((c) => {
                    const hidden = r.repeated.includes(c.key);
                    return (
                      <td
                        key={c.key}
                        className={cn(
                          "border px-2 py-1",
                          c.align === "right" && "text-right tabular-nums",
                          c.kind === "mono" && "font-mono",
                          // A repeated cell is left blank, not greyed: the eye
                          // reads the block as one invoice, the way it does on
                          // the printed document.
                          hidden && "border-t-0",
                        )}
                      >
                        {cell(c, r.values[c.key], hidden)}
                      </td>
                    );
                  })}
                </tr>
              ) : (
                <tr
                  key={i}
                  className={cn(
                    r.kind === "total"
                      ? "bg-muted/60 font-semibold"
                      : "bg-muted/30 font-medium",
                  )}
                >
                  {columns.map((c, n) => {
                    const v = r.values[c.key];
                    return (
                      <td
                        key={c.key}
                        className={cn(
                          "border px-2 py-1.5",
                          c.align === "right" && "text-right tabular-nums",
                        )}
                      >
                        {n === 0
                          ? r.label
                          : v == null
                            ? ""
                            : c.kind === "percent"
                              ? `${v.toFixed(1)}%`
                              : c.kind === "number"
                                ? String(v)
                                : taka(v)}
                      </td>
                    );
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
