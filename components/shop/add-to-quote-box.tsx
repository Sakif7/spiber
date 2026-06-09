"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { QtyStepper } from "./qty-stepper";
import { useQuoteList } from "./use-quote-list";

/** Quantity + "Add to quote" / "Request quotation" for Instruments detail. */
export function AddToQuoteBox({ productId }: { productId: string }) {
  const t = useTranslations("quotation");
  const router = useRouter();
  const { add } = useQuoteList();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

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
        <QtyStepper value={qty} onChange={setQty} max={9999} />
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
          {add.isPending ? t("adding") : t("addToQuote")}
        </CtaButton>
        <CtaButton
          onClick={() =>
            add.mutate(
              { productId, qty },
              { onSuccess: () => router.push("/medtrade/quote") },
            )
          }
        >
          {t("requestQuotation")}
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
          <span style={{ color: "var(--color-success)" }}>
            ✓ {t("addedToQuote")}
          </span>
          <Link
            href="/medtrade/quote"
            style={{
              color: "var(--color-brand-deep)",
              textDecoration: "underline",
            }}
          >
            {t("viewQuoteList")}
          </Link>
        </span>
      )}
    </div>
  );
}
