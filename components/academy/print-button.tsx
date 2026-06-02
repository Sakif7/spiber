"use client";

import { useTranslations } from "next-intl";
import { CtaButton } from "@/components/ui/cta-button";

export function PrintButton() {
  const t = useTranslations("academy.certificate");
  return (
    <CtaButton onClick={() => window.print()} variant="secondary">
      {t("print")}
    </CtaButton>
  );
}
