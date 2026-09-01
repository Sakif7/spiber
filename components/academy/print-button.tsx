"use client";

import { useTranslations } from "next-intl";
import { CtaButton } from "@/components/ui/cta-button";

/** `label` overrides the default certificate wording (invoices reuse this). */
export function PrintButton({ label }: { label?: string } = {}) {
  const t = useTranslations("academy.certificate");
  return (
    <CtaButton onClick={() => window.print()} variant="secondary">
      {label ?? t("print")}
    </CtaButton>
  );
}
