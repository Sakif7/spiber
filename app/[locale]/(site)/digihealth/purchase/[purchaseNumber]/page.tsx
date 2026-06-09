import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { CtaButton } from "@/components/ui/cta-button";
import { getPurchaseByNumber } from "@/lib/repositories/purchases.repo";
import { getLicenseByPurchaseId } from "@/lib/repositories/licenses.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ locale: string; purchaseNumber: string }>;
}) {
  const { locale, purchaseNumber } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "systems.purchase" });

  const user = await getSessionUser();
  if (!user) {
    redirect(
      `/${locale}?auth=login&next=/${locale}/digihealth/purchase/${purchaseNumber}`,
    );
  }

  const purchase = await getPurchaseByNumber(purchaseNumber);
  if (!purchase || String(purchase.userId) !== user.sub) notFound();

  const paid = purchase.status === "paid";
  const name = localize(purchase.productSnapshot.name, l);
  const { deliveryType } = purchase.productSnapshot;

  let licenseKey: string | null = null;
  if (paid && deliveryType === "license") {
    const license = await getLicenseByPurchaseId(String(purchase._id)).catch(
      () => null,
    );
    licenseKey = license?.key ?? null;
  }

  return (
    <section style={{ paddingBlock: "clamp(56px, 8vw, 120px)" }}>
      <Container style={{ maxWidth: 600, display: "grid", gap: "var(--s-5)" }}>
        <div
          style={{ textAlign: "center", display: "grid", gap: "var(--s-3)" }}
        >
          <span
            aria-hidden
            style={{
              justifySelf: "center",
              display: "grid",
              placeItems: "center",
              width: 56,
              height: 56,
              borderRadius: "var(--r-pill)",
              background: paid
                ? "var(--color-brand-soft)"
                : "var(--color-secondary-soft)",
              color: paid
                ? "var(--color-brand-deep)"
                : "var(--color-secondary-deep)",
              fontSize: 28,
            }}
          >
            {paid ? "✓" : "•"}
          </span>
          <h1
            style={{
              fontSize: "var(--fs-h2)",
              color: "var(--color-text-strong)",
              margin: 0,
            }}
          >
            {paid ? t("paidTitle") : t("pendingTitle")}
          </h1>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--fs-body-lg)",
              margin: 0,
            }}
          >
            {name} — {paid ? t("paidNote") : t("pendingNote")}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: 8,
            padding: "var(--s-5)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-lg)",
            background: "var(--color-surface)",
          }}
        >
          <Row label={t("reference")} value={purchase.purchaseNumber} mono />
          <Row
            label={t("total")}
            value={
              purchase.totalMinor > 0 ? formatBDT(purchase.totalMinor, l) : "—"
            }
          />
        </div>

        {/* Delivery */}
        {paid && (
          <div
            style={{
              display: "grid",
              gap: "var(--s-3)",
              padding: "var(--s-5)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              background: "var(--color-surface)",
            }}
          >
            {deliveryType === "asset" && (
              <CtaButton
                href={`/api/media/software/${String(purchase.softwareProductId)}`}
              >
                {t("download")}
              </CtaButton>
            )}
            {deliveryType === "license" && (
              <>
                <span
                  style={{
                    fontSize: "var(--fs-caption)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {t("license")}
                </span>
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--fs-body)",
                    color: "var(--color-text-strong)",
                    wordBreak: "break-all",
                  }}
                >
                  {licenseKey ?? "…"}
                </code>
              </>
            )}
            {deliveryType === "external" && (
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ color: "var(--color-text-strong)" }}>
                  {t("activationTitle")}
                </strong>
                <span style={{ color: "var(--color-text-muted)" }}>
                  {t("activationNote")}
                </span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center" }}>
          <CtaButton href="/account/software" variant="secondary">
            {t("viewLibrary")}
          </CtaButton>
        </div>
      </Container>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--s-4)",
      }}
    >
      <span
        style={{
          color: "var(--color-text-muted)",
          fontSize: "var(--fs-body-sm)",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          color: "var(--color-text-strong)",
          fontFamily: mono ? "var(--font-mono)" : "inherit",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
