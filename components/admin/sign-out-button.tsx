"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";

export function SignOutButton() {
  const t = useTranslations("admin");
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <CtaButton variant="secondary" onClick={signOut}>
      {t("signOut")}
    </CtaButton>
  );
}
