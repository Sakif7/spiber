"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { QtyStepper } from "./qty-stepper";
import { useCart } from "./use-cart";

export function AddToCart({
  productId,
  stockQty,
}: {
  productId: string;
  stockQty: number;
}) {
  const t = useTranslations("shop.product");
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (stockQty <= 0) {
    return (
      <p style={{ color: "var(--color-error)", fontWeight: 600 }}>
        {t("outOfStock")}
      </p>
    );
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4)" }}>
        <QtyStepper
          value={qty}
          onChange={setQty}
          max={Math.min(stockQty, 999)}
        />
        <CtaButton
          onClick={() =>
            add.mutate({ productId, qty }, { onSuccess: () => setAdded(true) })
          }
        >
          {add.isPending ? t("adding") : t("addToCart")}
        </CtaButton>
      </div>
      {added && (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
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
