import { Truck, ShieldCheck, Wallet, RotateCcw } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

/** Delivery / payment / guarantee trust strip for the marketplace. */
export async function TrustStrip({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "marketplace.trust" });
  const items = [
    { icon: Truck, title: t("deliveryTitle"), note: t("deliveryNote") },
    { icon: Wallet, title: t("paymentTitle"), note: t("paymentNote") },
    { icon: ShieldCheck, title: t("genuineTitle"), note: t("genuineNote") },
    { icon: RotateCcw, title: t("returnsTitle"), note: t("returnsNote") },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "var(--s-3)",
      }}
    >
      {items.map(({ icon: Icon, title, note }) => (
        <div
          key={title}
          style={{
            display: "flex",
            gap: "var(--s-3)",
            alignItems: "center",
            padding: "var(--s-4)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-lg)",
            background: "var(--color-surface)",
          }}
        >
          <Icon
            size={22}
            strokeWidth={1.75}
            color="var(--color-brand)"
            style={{ flexShrink: 0 }}
            aria-hidden
          />
          <div style={{ display: "grid", gap: 2 }}>
            <strong
              style={{
                fontSize: "var(--fs-body-sm)",
                color: "var(--color-text-strong)",
              }}
            >
              {title}
            </strong>
            <span
              style={{
                fontSize: "var(--fs-caption)",
                color: "var(--color-text-muted)",
              }}
            >
              {note}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
