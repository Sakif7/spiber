"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { formatApiError } from "@/lib/http/form-error";

export type BrandRow = {
  id: string;
  nameEn: string;
  nameBn?: string;
  slug: string;
};

/**
 * Flat, manually-orderable brand list. The up/down arrows re-number the whole
 * list 0..n-1 (so the order sticks even when every row started at position 0),
 * which drives brand order everywhere: filters, dropdowns, and the "By brand"
 * nav cascade.
 */
export function BrandList({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

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
    if (!window.confirm(`Delete brand "${b.nameEn}"?`)) return;
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
      <p
        style={{
          margin: 0,
          padding: "var(--s-6)",
          textAlign: "center",
          color: "var(--color-text-muted)",
        }}
      >
        No brands yet.
      </p>
    );
  }

  return (
    <div>
      {brands.map((b, index) => (
        <div
          key={b.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-3)",
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-border)",
            opacity: busy === b.id ? 0.5 : 1,
          }}
        >
          <span
            aria-hidden
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-caption)",
              color: "var(--color-text-subtle)",
              width: 22,
              textAlign: "right",
            }}
          >
            {index + 1}
          </span>
          <span style={{ flex: 1, color: "var(--color-text-strong)" }}>
            {b.nameEn}
            {b.nameBn && (
              <span style={{ color: "var(--color-text-muted)" }}>
                {" "}
                · {b.nameBn}
              </span>
            )}
            <span
              style={{
                marginLeft: 8,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-caption)",
                color: "var(--color-text-muted)",
              }}
            >
              {b.slug}
            </span>
          </span>
          <button
            type="button"
            onClick={() => move(index, -1)}
            disabled={index === 0}
            style={iconBtn(index === 0)}
            aria-label={`Move ${b.nameEn} up`}
            title="Move up"
          >
            <ChevronUp size={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => move(index, 1)}
            disabled={index === brands.length - 1}
            style={iconBtn(index === brands.length - 1)}
            aria-label={`Move ${b.nameEn} down`}
            title="Move down"
          >
            <ChevronDown size={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => remove(b)}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "var(--color-error)",
              fontSize: "var(--fs-small)",
              fontFamily: "inherit",
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

const iconBtn = (disabled: boolean): React.CSSProperties => ({
  display: "inline-grid",
  placeItems: "center",
  width: 28,
  height: 28,
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "transparent",
  cursor: disabled ? "default" : "pointer",
  color: disabled ? "var(--color-text-subtle)" : "var(--color-text)",
  opacity: disabled ? 0.45 : 1,
});
