"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { RowActions, type RowAction } from "@/components/admin/ui/row-actions";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import type { SortDir } from "@/lib/admin/list-params";
import { formatApiError } from "@/lib/http/form-error";
import { cn } from "@/lib/cn";
import { StockDrawer, type DrawerMode } from "./stock-drawer";
import { BulkDrawer } from "./bulk-drawer";
import { LEVEL_LABEL, formatDelta, type HubUnit } from "./types";

const TYPE_LABEL: Record<string, string> = {
  purchase: "received",
  sale: "sale",
  adjustment: "adjusted",
  return: "returned",
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

/**
 * The inventory hub table: stock units with selection + bulk receive, and the
 * per-unit adjust / set-to drawer. The page owns the URL state (search,
 * filters, sort, paging); this component owns only transient UI state.
 */
export function InventoryTable({
  units,
  sort,
  filtered,
}: {
  units: HubUnit[];
  sort: { key: string; dir: SortDir };
  filtered: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{
    unit: HubUnit;
    mode: DrawerMode;
  } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [tracking, setTracking] = useState<string | null>(null);

  const selectedUnits = units.filter((u) => selected.has(u.key));
  const allOnPage = units.length > 0 && selected.size === units.length;

  function openDrawer(unit: HubUnit, mode: DrawerMode) {
    setDrawer({ unit, mode });
    setDrawerOpen(true);
  }

  function toggle(key: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function setTrackStock(unit: HubUnit, value: boolean | null) {
    setTracking(unit.productId);
    try {
      const res = await fetch("/api/admin/inventory/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: unit.productId, trackStock: value }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        toast.error(formatApiError(json, "Could not update tracking"));
        return;
      }
      toast.success(
        value === false
          ? `${unit.sku}: stock tracking off`
          : value === true
            ? `${unit.sku}: stock tracking on`
            : `${unit.sku}: tracking follows the default rule`,
      );
      router.refresh();
    } finally {
      setTracking(null);
    }
  }

  function rowActions(u: HubUnit): RowAction[] {
    const actions: RowAction[] = [
      {
        label: u.seller ? "Override stock…" : "Adjust stock…",
        onSelect: () => openDrawer(u, "adjust"),
        icon: "edit",
      },
      {
        label: "Set stock to…",
        onSelect: () => openDrawer(u, "set"),
      },
      { label: "Movement history", href: u.historyHref, icon: "view" },
      { label: "Open product", href: u.editorHref, icon: "open" },
    ];
    if (u.storefront === "instruments" && !u.seller) {
      actions.push(
        u.tracked
          ? {
              label: "Stop tracking stock",
              onSelect: () => void setTrackStock(u, false),
              separatorBefore: true,
              disabled: tracking === u.productId,
            }
          : {
              label: "Track stock",
              onSelect: () => void setTrackStock(u, true),
              separatorBefore: true,
              disabled: tracking === u.productId,
            },
      );
      if (u.trackStock !== null) {
        actions.push({
          label: "Use the default rule",
          onSelect: () => void setTrackStock(u, null),
          disabled: tracking === u.productId,
        });
      }
    }
    return actions;
  }

  const columns: Column<HubUnit>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          aria-label="Select all units on this page"
          className="size-4 cursor-pointer accent-[var(--color-brand)]"
          checked={allOnPage}
          onChange={(e) =>
            setSelected(
              e.target.checked ? new Set(units.map((u) => u.key)) : new Set(),
            )
          }
        />
      ),
      className: "w-8 pr-0",
      headClassName: "w-8 pr-0",
      mobile: "hidden",
      cell: (u) => (
        <input
          type="checkbox"
          aria-label={`Select ${u.sku}`}
          className="size-4 cursor-pointer accent-[var(--color-brand)]"
          checked={selected.has(u.key)}
          onChange={(e) => toggle(u.key, e.target.checked)}
        />
      ),
    },
    {
      key: "product",
      header: "Product",
      sortKey: "name",
      sortDir: "asc",
      mobile: "primary",
      cell: (u) => (
        <div className="min-w-0">
          <Link
            href={u.editorHref}
            className="text-foreground block max-w-[18rem] truncate font-medium hover:underline"
          >
            {u.name}
            {u.variantLabel && (
              <span className="text-muted-foreground font-normal">
                {" "}
                · {u.variantLabel}
              </span>
            )}
          </Link>
          <p className="text-muted-foreground max-w-[18rem] truncate text-xs">
            {[u.categoryName, u.brandName].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      sortKey: "sku",
      sortDir: "asc",
      mobile: "meta",
      cell: (u) => (
        <span
          className="block max-w-[11rem] truncate font-mono text-xs"
          title={u.sku}
        >
          {u.sku}
        </span>
      ),
    },
    {
      key: "store",
      header: "Store",
      mobile: "meta",
      cell: (u) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-muted-foreground">{u.storeLabel}</span>
          {u.seller && (
            <span
              className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] font-medium"
              title={`Listed by ${u.seller.name} — stock is managed in the seller portal`}
            >
              Seller
            </span>
          )}
          {u.status !== "active" && (
            <StatusBadge dot={false} className="px-1.5 py-0 text-[11px]">
              {u.status}
            </StatusBadge>
          )}
        </span>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      sortKey: "stock",
      sortDir: "asc",
      mobile: "meta",
      cell: (u) =>
        u.tracked ? (
          <span className="inline-flex items-center justify-end gap-2">
            {u.level && u.level !== "ok" && (
              <StatusBadge
                dot={false}
                tone={u.level === "out" ? "danger" : "warning"}
                className="px-1.5 py-0 text-[11px]"
              >
                {LEVEL_LABEL[u.level]}
              </StatusBadge>
            )}
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                u.level === "out" && "text-destructive",
                u.level === "low" && "text-[var(--color-warning)]",
              )}
            >
              {u.stock}
            </span>
          </span>
        ) : (
          <span
            className="text-muted-foreground"
            title="Quotation-only product — stock is not tracked"
          >
            —
          </span>
        ),
    },
    {
      key: "threshold",
      header: "Low at",
      align: "right",
      mobile: "meta",
      cell: (u) =>
        u.tracked ? (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {u.threshold}
          </span>
        ) : null,
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      sortKey: "value",
      mobile: "meta",
      cell: (u) =>
        u.valueLabel ? (
          <span className="text-muted-foreground tabular-nums">
            {u.valueLabel}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "last",
      header: "Last movement",
      mobile: "meta",
      cell: (u) =>
        u.lastMovement ? (
          <span className="text-muted-foreground whitespace-nowrap">
            <span
              className={cn(
                "font-mono tabular-nums",
                u.lastMovement.qtyDelta < 0
                  ? "text-destructive"
                  : "text-[var(--color-success)]",
              )}
            >
              {formatDelta(u.lastMovement.qtyDelta)}
            </span>{" "}
            {TYPE_LABEL[u.lastMovement.type] ?? u.lastMovement.type} ·{" "}
            {timeAgo(u.lastMovement.at)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-28 whitespace-nowrap",
      cell: (u) => (
        <span className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => openDrawer(u, "adjust")}
          >
            {u.seller ? "Override" : "Adjust"}
          </Button>
          <RowActions label={`Actions for ${u.sku}`} actions={rowActions(u)} />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 shadow-[var(--shadow-sm)]">
          <strong className="mr-1 text-[13px]">{selected.size} selected</strong>
          <Button type="button" size="sm" onClick={() => setBulkOpen(true)}>
            <PackageOpen className="size-4" />
            Receive / adjust…
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={units}
        getRowKey={(u) => u.key}
        rowClassName={(u) =>
          cn(
            selected.has(u.key) && "bg-primary/5",
            u.level === "out" && "bg-destructive/5",
          )
        }
        sort={sort}
        empty={
          filtered ? "No stock units match these filters." : "No products yet."
        }
        emptyDescription={
          filtered
            ? "Try a different name or SKU, or clear the filters."
            : "Products appear here as soon as they are created in Medtrade or Spiber Kart."
        }
        minWidth={980}
      />

      <StockDrawer
        unit={drawer?.unit ?? null}
        mode={drawer?.mode ?? "adjust"}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
      <BulkDrawer
        units={selectedUnits}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onApplied={() => setSelected(new Set())}
      />
    </div>
  );
}
