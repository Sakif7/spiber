import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CtaButton } from "@/components/ui/cta-button";
import { listPurchasesByUser } from "@/lib/repositories/purchases.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function MySoftwarePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "systems.library" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}?auth=login&next=/${locale}/account/software`);
  }

  let items: Awaited<ReturnType<typeof listPurchasesByUser>> = [];
  try {
    items = await listPurchasesByUser(user.sub);
  } catch (e) {
    logger.warn("my software load failed", e);
  }

  return (
    <>
      <PageHeader
        eyebrow={nav("systems")}
        title={t("title")}
        breadcrumbs={[{ label: nav("home"), href: "/" }, { label: t("title") }]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container>
          {items.length === 0 ? (
            <div
              style={{
                display: "grid",
                gap: "var(--s-5)",
                justifyItems: "start",
              }}
            >
              <p style={{ color: "var(--color-text-muted)" }}>{t("empty")}</p>
              <CtaButton href="/digihealth/products">{t("browse")}</CtaButton>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--s-4)" }}>
              {items.map((p) => {
                const paid = p.status === "paid";
                const statusLabel = !paid
                  ? t("pending")
                  : p.productSnapshot.deliveryType === "asset"
                    ? t("download")
                    : p.productSnapshot.deliveryType === "license"
                      ? t("license")
                      : t("activation");
                return (
                  <div
                    key={String(p._id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--s-5)",
                      flexWrap: "wrap",
                      padding: "var(--s-5)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--r-lg)",
                      background: "var(--color-surface)",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: 220,
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      <strong style={{ color: "var(--color-text-strong)" }}>
                        {localize(p.productSnapshot.name, l)}
                      </strong>
                      <span
                        style={{
                          fontSize: "var(--fs-caption)",
                          color: paid
                            ? "var(--color-success)"
                            : "var(--color-text-muted)",
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <CtaButton
                      href={`/digihealth/purchase/${p.purchaseNumber}`}
                      variant="secondary"
                    >
                      {t("view")}
                    </CtaButton>
                  </div>
                );
              })}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
