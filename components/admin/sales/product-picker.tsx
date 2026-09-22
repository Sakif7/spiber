"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";

/**
 * A stock unit as the sales product search returns it: a simple product or
 * one variant, with what is still available and the prefill for the printed
 * columns.
 */
export type ProductHit = {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  sku: string;
  priceMinor: number | null;
  costPriceMinor: number | null;
  onHand: number;
  reserved: number;
  available: number;
  tracked: boolean;
  /** Prefill for the printed columns, resolved server-side from the catalogue. */
  description: string;
  specification: string;
  brandOrigin: string;
  /** The two halves of Brand/Origin, for an equipment line's own fields. */
  brand?: string;
  origin?: string;
};

const money = (minor: number) =>
  `৳${(minor / 100).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

/**
 * Search the catalogue and add a product as a line.
 *
 * Shared by the consumables table, the equipment order's machine and its
 * accessories — all three add stock-moving lines, and a second copy of this
 * would be a second place for "what does the picker prefill" to drift.
 */
export function ProductPicker({
  onPick,
  label = "Add product",
  variant = "default",
  align = "end",
  disabled,
}: {
  onPick: (hit: ProductHit) => void;
  label?: string;
  variant?: "default" | "outline";
  align?: "start" | "center" | "end";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(value: string) {
    setQ(value);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/company/sales/products?q=${encodeURIComponent(value)}`,
      );
      const json = await res.json().catch(() => null);
      if (res.ok) setHits(json?.data?.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && hits.length === 0) void search("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={variant}
          className="gap-1.5"
          disabled={disabled}
        >
          <Plus className="size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-2" align={align}>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => void search(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !hits[0]) return;
              e.preventDefault();
              onPick(hits[0]);
              setQ("");
              void search("");
            }}
            placeholder="Search by name or SKU…"
            className="h-8 pl-8"
            autoFocus
          />
        </div>
        <p className="text-muted-foreground text-admin-2xs mt-1.5">
          Press Enter to add the first match. The list stays open so you can add
          several.
        </p>
        <div className="mt-2 max-h-72 overflow-y-auto">
          {loading && hits.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">
              No products match.
            </p>
          ) : (
            hits.map((h) => (
              <button
                key={`${h.productId}:${h.variantId ?? ""}`}
                type="button"
                onClick={() => {
                  onPick(h);
                  setQ("");
                  void search("");
                }}
                className="hover:bg-accent flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {h.name}
                    {h.variantLabel ? ` · ${h.variantLabel}` : ""}
                  </span>
                  <span className="text-muted-foreground text-admin-2xs block font-mono">
                    {h.sku}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block">
                    {h.priceMinor == null ? "—" : money(h.priceMinor)}
                  </span>
                  <span
                    className={cn(
                      "text-admin-2xs block",
                      h.tracked && h.available <= 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {h.tracked ? `${h.available} available` : "not tracked"}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
