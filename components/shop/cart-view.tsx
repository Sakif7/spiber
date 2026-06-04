"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { Placeholder } from "@/components/ui/placeholder";
import { formatBDT } from "@/lib/money";
import { QtyStepper } from "./qty-stepper";
import { useCart } from "./use-cart";
import type { Locale } from "@/i18n/routing";

export function CartView() {
  const t = useTranslations("shop.cart");
  const locale = useLocale() as Locale;
  const { cart, isLoading, update, remove } = useCart();

  if (isLoading) return <p style={{ color: "var(--color-text-muted)" }}>…</p>;

  if (!cart || cart.items.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-5)",
          alignItems: "flex-start",
        }}
      >
        <p style={{ color: "var(--color-text-muted)" }}>{t("empty")}</p>
        <CtaButton href="/marketplace">{t("emptyCta")}</CtaButton>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "var(--s-6)",
        gridTemplateColumns: "1fr",
        maxWidth: 760,
      }}
    >
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: "var(--s-4)",
        }}
      >
        {cart.items.map((item) => (
          <li
            key={`${item.productId}:${item.variantId ?? ""}`}
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr auto",
              gap: "var(--s-4)",
              alignItems: "center",
              padding: "var(--s-4)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              background: "var(--color-surface)",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                position: "relative",
                borderRadius: "var(--r-sm)",
                overflow: "hidden",
                background: "var(--color-surface-2)",
              }}
            >
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="72px"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <Placeholder
                  label={item.name}
                  tone="teal"
                  style={{ position: "absolute", inset: 0 }}
                />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Link
                href={`/marketplace/product/${item.slug}`}
                style={{ fontWeight: 600, color: "var(--color-text-strong)" }}
              >
                {item.name}
              </Link>
              {item.variantLabel && (
                <span
                  style={{
                    fontSize: "var(--fs-caption)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {item.variantLabel}
                </span>
              )}
              <span style={{ color: "var(--color-brand-deep)" }}>
                {formatBDT(item.priceMinor, locale)}
              </span>
              {!item.inStock && (
                <span
                  style={{
                    fontSize: "var(--fs-caption)",
                    color: "var(--color-error)",
                  }}
                >
                  {t("outOfStock")}
                </span>
              )}
              <QtyStepper
                value={item.qty}
                max={Math.min(item.stockQty, 999)}
                onChange={(qty) =>
                  update.mutate({
                    productId: item.productId,
                    variantId: item.variantId,
                    qty,
                  })
                }
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              <strong>{formatBDT(item.lineTotalMinor, locale)}</strong>
              <button
                type="button"
                onClick={() =>
                  remove.mutate({
                    productId: item.productId,
                    variantId: item.variantId,
                  })
                }
                style={{
                  background: "none",
                  border: 0,
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  fontSize: "var(--fs-small)",
                  textDecoration: "underline",
                }}
              >
                {t("remove")}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid var(--color-hairline)",
          paddingTop: "var(--s-4)",
        }}
      >
        <span style={{ color: "var(--color-text-muted)" }}>
          {t("subtotal")}
        </span>
        <strong style={{ fontSize: "var(--fs-h4)" }}>
          {formatBDT(cart.subtotalMinor, locale)}
        </strong>
      </div>

      <div style={{ display: "flex", gap: "var(--s-4)", flexWrap: "wrap" }}>
        <CtaButton href="/marketplace/checkout">{t("checkout")}</CtaButton>
        <CtaButton href="/marketplace" variant="secondary">
          {t("continue")}
        </CtaButton>
      </div>
    </div>
  );
}
