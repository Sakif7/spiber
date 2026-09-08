"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatApiError } from "@/lib/http/form-error";
import { BrandForm, type BrandFormValue } from "@/components/admin/brand-form";

export type BrandRow = {
  id: string;
  nameEn: string;
  nameBn?: string;
  nameJa?: string;
  slug: string;
  logo?: string;
};

/**
 * Flat, manually-orderable brand list. Each row shows the brand's logo (or a
 * monogram fallback) and expands into the {@link BrandForm} for editing the
 * name/slug/logo. The up/down arrows re-number the whole list 0..n-1 (so the
 * order sticks even when every row started at position 0), which drives brand
 * order everywhere: filters, dropdowns, the storefront brand strip, and the
 *"By brand" nav cascade.
 */
export function BrandList({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= brands.length) return;
    const order = brands.map((b) => b.id);
    [order[index], order[j]] = [order[j], order[index]];
    setBusy(brands[index].id);
    try {
      const res = await fetch(`/api/admin/brands/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: order.map((id, position) => ({ id, position })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) router.refresh();
      else window.alert(formatApiError(json));
    } finally {
      setBusy(null);
    }
  }

  async function remove(b: BrandRow) {
    if (!window.confirm(`Delete brand"${b.nameEn}"?`)) return;
    setBusy(b.id);
    try {
      const res = await fetch(`/api/admin/brands/${b.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) router.refresh();
      else window.alert(formatApiError(json, "delete_failed"));
    } finally {
      setBusy(null);
    }
  }

  if (brands.length === 0) {
    return (
      <p className="text-muted-foreground p-6 text-center">No brands yet.</p>
    );
  }

  return (
    <div className="divide-border/60 divide-y">
      {brands.map((b, index) => {
        const monogram =
          b.nameEn
            .replace(/[^\p{L}\p{N}]/gu, "")
            .slice(0, 2)
            .toUpperCase() || "•";
        const value: BrandFormValue = {
          id: b.id,
          nameEn: b.nameEn,
          nameBn: b.nameBn,
          nameJa: b.nameJa,
          slug: b.slug,
          logo: b.logo,
        };
        return (
          <div key={b.id}>
            <div
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5",
                busy === b.id && "opacity-50",
              )}
            >
              <span
                aria-hidden
                className="text-muted-foreground w-6 shrink-0 text-right font-mono text-xs tabular-nums"
              >
                {index + 1}
              </span>
              <span className="bg-muted border-border relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border">
                {b.logo ? (
                  <Image
                    src={b.logo}
                    alt=""
                    fill
                    sizes="40px"
                    className="p-1"
                    style={{ objectFit: "contain" }}
                  />
                ) : (
                  <span className="text-primary font-bold">{monogram}</span>
                )}
              </span>
              <span className="text-foreground min-w-0 flex-1">
                {b.nameEn}
                {b.nameBn && (
                  <span className="text-muted-foreground"> · {b.nameBn}</span>
                )}
                <span className="text-muted-foreground ml-2 font-mono text-xs">
                  {b.slug}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${b.nameEn} up`}
                title="Move up"
              >
                <ChevronUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => move(index, 1)}
                disabled={index === brands.length - 1}
                aria-label={`Move ${b.nameEn} down`}
                title="Move down"
              >
                <ChevronDown />
              </Button>
              <Button
                type="button"
                variant={editing === b.id ? "secondary" : "ghost"}
                size="sm"
                onClick={() =>
                  setEditing((cur) => (cur === b.id ? null : b.id))
                }
                aria-expanded={editing === b.id}
              >
                <Pencil />
                {editing === b.id ? "Close" : "Edit"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                onClick={() => remove(b)}
                aria-label={`Delete ${b.nameEn}`}
                title="Delete"
              >
                <Trash2 />
              </Button>
            </div>
            {editing === b.id && (
              <div className="bg-muted/40 pt-4 pr-3.5 pb-5 pl-[52px]">
                <BrandForm brand={value} onDone={() => setEditing(null)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
