"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { QtyStepper } from "./qty-stepper";
import { useCart } from "./use-cart";
import { useQuoteList } from "./use-quote-list";

/**
 * Buy box for a PRICED Medtrade product: add to the Medtrade cart, buy now, or
 * open a negotiation.
 *
 * "Negotiate price" is not a discount button — it drops the item into the
 * existing RFQ pipeline, where an admin quotes against the product's floor
 * price. Checkout itself always bills the list price.
 *
 * Price-less products keep `AddToQuoteBox` instead (quotation-only).
 */
export function MedtradeBuyBox({
  productId,
  stockQty,
}: {
  productId: string;
  stockQty: number;
}) {
  const t = useTranslations("shop.product");
  const tq = useTranslations("quotation");
  const router = useRouter();
  const { add } = useCart("instruments");
  const quote = useQuoteList();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const outOfStock = stockQty <= 0;
  const max = outOfStock ? 1 : Math.min(999, stockQty);
  const canBuy = !outOfStock && !add.isPending;
  // CtaButton has no `disabled` prop — the codebase disables via opacity +
  // pointer-events (see components/marketplace/buy-box.tsx).
  const offStyle = (enabled: boolean) => ({
    opacity: enabled ? 1 : 0.5,
    pointerEvents: enabled ? ("auto" as const) : ("none" as const),
  });

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
        <QtyStepper value={qty} onChange={setQty} max={max} />
        {!outOfStock && stockQty <= 10 && (
          <span
            style={{
              fontSize: "var(--fs-caption)",
              color: "var(--color-warning, var(--color-text-muted))",
            }}
          >
            {t("lowStock", { count: stockQty })}
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
          style={offStyle(canBuy)}
          onClick={() =>
            canBuy &&
            add.mutate({ productId, qty }, { onSuccess: () => setAdded(true) })
          }
        >
          {outOfStock
            ? t("outOfStock")
            : add.isPending
              ? t("adding")
              : t("addToCart")}
        </CtaButton>
        <CtaButton
          style={offStyle(canBuy)}
          onClick={() =>
            canBuy &&
            add.mutate(
              { productId, qty },
              { onSuccess: () => router.push("/medtrade/checkout") },
            )
          }
        >
          {t("buyNow")}
        </CtaButton>
      </div>

      {/* Negotiation stays available even when stock is out — it's a lead. */}
      <CtaButton
        variant="secondary"
        style={offStyle(!quote.add.isPending)}
        onClick={() =>
          !quote.add.isPending &&
          quote.add.mutate(
            { productId, qty },
            { onSuccess: () => router.push("/medtrade/quote") },
          )
        }
      >
        {quote.add.isPending ? tq("adding") : tq("negotiatePrice")}
      </CtaButton>

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
            href="/medtrade/cart"
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
