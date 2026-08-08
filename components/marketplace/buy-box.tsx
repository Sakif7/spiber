"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { QtyStepper } from "@/components/shop/qty-stepper";
import { useCart } from "@/components/shop/use-cart";
import { formatBDT } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

export type ClientVariantOption = {
  name: string; // en key
  label: string; // localized
  values: { value: string; label: string }[];
};
export type ClientVariant = {
  id: string;
  options: { name: string; value: string }[]; // en keys
  priceMinor: number | null;
  stockQty: number;
  sku: string;
};

export function MarketplaceBuyBox({
  productId,
  basePriceMinor,
  compareAtMinor = null,
  baseStockQty,
  options,
  variants,
  locale,
}: {
  productId: string;
  basePriceMinor: number | null;
  /** Optional "was" price — rendered struck-through with a save badge. */
  compareAtMinor?: number | null;
  baseStockQty: number;
  options: ClientVariantOption[];
  variants: ClientVariant[];
  locale: Locale;
}) {
  const t = useTranslations("shop.product");
  const tm = useTranslations("marketplace.product");
  const router = useRouter();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});

  const hasVariants = variants.length > 0;
  const allSelected = options.every((o) => selected[o.name]);

  const selectedVariant = useMemo(() => {
    if (!hasVariants || !allSelected) return undefined;
    return variants.find((v) =>
      v.options.every((o) => selected[o.name] === o.value),
    );
  }, [hasVariants, allSelected, variants, selected]);

  const price = hasVariants
    ? (selectedVariant?.priceMinor ?? null)
    : basePriceMinor;
  const stock = hasVariants ? (selectedVariant?.stockQty ?? 0) : baseStockQty;

  const needsSelection = hasVariants && !selectedVariant;
  const out = !needsSelection && stock <= 0;
  const variantId = selectedVariant?.id ?? null;

  const canAdd = !needsSelection && !out;

  return (
    <div style={{ display: "grid", gap: "var(--s-4)" }}>
      {/* Price (+ optional compare-at strike & save badge) */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-h2)",
          color: "var(--color-brand-deep)",
          fontWeight: 700,
        }}
      >
        {price != null ? (
          <>
            {formatBDT(price, locale)}
            {compareAtMinor != null && compareAtMinor > price && (
              <>
                <s
                  style={{
                    fontSize: "var(--fs-h5)",
                    fontWeight: 500,
                    color: "var(--color-text-subtle)",
                  }}
                >
                  {formatBDT(compareAtMinor, locale)}
                </s>
                <span
                  style={{
                    fontFamily: "var(--font-sans, inherit)",
                    fontSize: "var(--fs-caption)",
                    fontWeight: 700,
                    color: "var(--color-secondary)",
                    background:
                      "color-mix(in oklab, var(--color-secondary) 12%, transparent)",
                    borderRadius: "var(--r-pill)",
                    padding: "3px 10px",
                  }}
                >
                  −{Math.round((1 - price / compareAtMinor) * 100)}%
                </span>
              </>
            )}
          </>
        ) : hasVariants ? (
          <span
            style={{
              fontSize: "var(--fs-h5)",
              color: "var(--color-text-muted)",
            }}
          >
            {tm("selectToSeePrice")}
          </span>
        ) : (
          "—"
        )}
      </div>

      {/* Variant option pickers */}
      {options.map((opt) => (
        <div key={opt.name} style={{ display: "grid", gap: 6 }}>
          <span
            style={{
              fontSize: "var(--fs-body-sm)",
              color: "var(--color-text-muted)",
              fontWeight: 600,
            }}
          >
            {opt.label}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {opt.values.map((val) => {
              const active = selected[opt.name] === val.value;
              return (
                <button
                  key={val.value}
                  type="button"
                  onClick={() =>
                    setSelected((s) => ({ ...s, [opt.name]: val.value }))
                  }
                  style={{
                    padding: "8px 14px",
                    borderRadius: "var(--r-pill)",
                    border: `1px solid ${active ? "var(--color-brand)" : "var(--color-border)"}`,
                    background: active
                      ? "var(--color-brand-soft)"
                      : "var(--color-surface)",
                    color: active
                      ? "var(--color-brand-deep)"
                      : "var(--color-text)",
                    fontWeight: active ? 600 : 500,
                    fontSize: "var(--fs-body-sm)",
                    cursor: "pointer",
                  }}
                >
                  {val.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Stock state (low-stock urgency when ≤10 left) */}
      {!needsSelection &&
        (() => {
          const low = !out && stock <= 10;
          const color = out
            ? "var(--color-error)"
            : low
              ? "var(--color-secondary)"
              : "var(--color-success)";
          return (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "var(--fs-body-sm)",
                fontWeight: 600,
                color,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: color,
                }}
              />
              {out
                ? t("outOfStock")
                : low
                  ? t("lowStock", { count: stock })
                  : t("inStock")}
            </span>
          );
        })()}

      {/* Qty + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
        <span
          style={{
            fontSize: "var(--fs-body-sm)",
            color: "var(--color-text-muted)",
          }}
        >
          {t("quantity")}
        </span>
        <QtyStepper
          value={qty}
          onChange={setQty}
          max={Math.max(1, Math.min(stock || 1, 999))}
        />
        {!needsSelection && !out && qty >= stock && (
          <span
            style={{
              fontSize: "var(--fs-caption)",
              color: "var(--color-secondary)",
              fontWeight: 600,
            }}
          >
            {t("lowStock", { count: stock })}
          </span>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--s-3)",
        }}
      >
        <CtaButton
          variant="secondary"
          onClick={() =>
            canAdd &&
            add.mutate(
              { productId, qty, variantId },
              { onSuccess: () => setAdded(true) },
            )
          }
          style={{
            opacity: canAdd ? 1 : 0.5,
            pointerEvents: canAdd ? "auto" : "none",
          }}
        >
          {needsSelection
            ? tm("selectOptions")
            : add.isPending
              ? t("adding")
              : t("addToCart")}
        </CtaButton>
        <CtaButton
          onClick={() =>
            canAdd &&
            add.mutate(
              { productId, qty, variantId },
              { onSuccess: () => router.push("/kart/checkout") },
            )
          }
          style={{
            opacity: canAdd ? 1 : 0.5,
            pointerEvents: canAdd ? "auto" : "none",
          }}
        >
          {t("buyNow")}
        </CtaButton>
      </div>
      {added && (
        <span
          style={{ fontSize: "var(--fs-small)", color: "var(--color-success)" }}
        >
          ✓ {t("added")}
        </span>
      )}
    </div>
  );
}
