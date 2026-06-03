"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { QtyStepper } from "./qty-stepper";
import { useCart } from "./use-cart";

/** Quantity + Add-to-cart + Buy-now (buy-now adds, then routes to checkout). */
export function BuyBox({
  productId,
  stockQty,
}: {
  productId: string;
  stockQty: number;
}) {
  const t = useTranslations("shop.product");
  const router = useRouter();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (stockQty <= 0) {
    return (
      <p style={{ color: "var(--color-error)", fontWeight: 600, margin: 0 }}>
        {t("outOfStock")}
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-4)" }}>
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
          max={Math.min(stockQty, 999)}
        />
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
            add.mutate({ productId, qty }, { onSuccess: () => setAdded(true) })
          }
        >
          {add.isPending ? t("adding") : t("addToCart")}
        </CtaButton>
        <CtaButton
          onClick={() =>
            add.mutate(
              { productId, qty },
              { onSuccess: () => router.push("/instruments/checkout") },
            )
          }
        >
          {t("buyNow")}
        </CtaButton>
      </div>
      {added && (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: "var(--fs-small)",
          }}
        >
          <span style={{ color: "var(--color-success)" }}>✓ {t("added")}</span>
          <Link
            href="/instruments/cart"
            style={{
              color: "var(--color-brand-deep)",
              textDecoration: "underline",
            }}
          >
            {t("viewCart")}
          </Link>
        </span>
      )}
    </div>
  );
}
