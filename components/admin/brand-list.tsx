"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronUp, ChevronDown, Pencil } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
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
 * "By brand" nav cascade.
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
          <div
            key={b.id}
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-3)",
                padding: "10px 14px",
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
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {b.logo ? (
                  <Image
                    src={b.logo}
                    alt=""
                    fill
                    sizes="40px"
                    style={{ objectFit: "contain", padding: 4 }}
                  />
                ) : (
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--color-brand-deep)",
                    }}
                  >
                    {monogram}
                  </span>
                )}
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
                onClick={() =>
                  setEditing((cur) => (cur === b.id ? null : b.id))
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--r-sm)",
                  background:
                    editing === b.id ? "var(--color-surface-2)" : "transparent",
                  cursor: "pointer",
                  color: "var(--color-text)",
                  fontSize: "var(--fs-small)",
                  fontFamily: "inherit",
                  padding: "5px 10px",
                }}
              >
                <Pencil size={13} aria-hidden />
                {editing === b.id ? "Close" : "Edit"}
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
            {editing === b.id && (
              <div
                style={{
                  padding: "var(--s-4) 14px var(--s-5) 52px",
                  background: "var(--color-surface-2)",
                }}
              >
                <BrandForm brand={value} onDone={() => setEditing(null)} />
              </div>
            )}
          </div>
        );
      })}
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
