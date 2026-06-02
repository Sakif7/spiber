"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { useSession } from "@/components/auth/use-session";
import { useAuthModal } from "@/components/auth/auth-modal";

export function SoftwareBuyButton({
  productId,
  slug,
  owned,
}: {
  productId: string;
  slug: string;
  owned: boolean;
}) {
  const t = useTranslations("systems.buy");
  const router = useRouter();
  const { user, isLoading } = useSession();
  const { open } = useAuthModal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (owned) {
    return (
      <CtaButton href="/account/software" variant="primary">
        {t("owned")}
      </CtaButton>
    );
  }

  if (!isLoading && !user) {
    return (
      <CtaButton
        onClick={() => open("login", { next: `/systems/product/${slug}` })}
      >
        {t("signInToBuy")}
      </CtaButton>
    );
  }

  async function buy() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/systems/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        softwareProductId: productId,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      router.push(`/systems/purchase/${json.data.purchaseNumber}`);
      router.refresh();
    } else {
      setError(
        json?.error?.code === "already_owned" ? t("alreadyOwned") : t("error"),
      );
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <CtaButton onClick={buy} style={{ opacity: busy || isLoading ? 0.7 : 1 }}>
        {busy ? t("processing") : t("buyNow")}
      </CtaButton>
      {error && (
        <span
          style={{ color: "var(--color-error)", fontSize: "var(--fs-caption)" }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
