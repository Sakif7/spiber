import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { CtaButton } from "@/components/ui/cta-button";
import { SoftwareCard } from "@/components/systems/software-card";
import { listSoftwareProducts } from "@/lib/repositories/software.repo";
import { HERO } from "@/lib/hero-images";
import { namespaceMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(locale as Locale, "hubs.systems", "/systems");
}

export default async function SystemsHub({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "systems" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const hub = await getTranslations({ locale, namespace: "hubs.systems" });

  let items: Awaited<ReturnType<typeof listSoftwareProducts>>["items"] = [];
  try {
    const res = await listSoftwareProducts({ status: "active", pageSize: 8 });
    items = res.items;
  } catch (e) {
    logger.warn("systems hub data load failed", e);
  }

  return (
    <>
      <PageHeader
        eyebrow={hub("eyebrow")}
        title={t("hub.title")}
        description={t("hub.lede")}
        image={HERO.systemsHub}
        imageAlt={t("hub.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("hub.title") },
        ]}
      />
      {items.length === 0 ? (
        <ComingSoon />
      ) : (
        <section style={{ paddingBlock: "clamp(48px, 6vw, 96px)" }}>
          <Container
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-8)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--s-4)",
                flexWrap: "wrap",
              }}
            >
              <h2
                style={{
                  fontSize: "var(--fs-h3)",
                  color: "var(--color-text-strong)",
                }}
              >
                {t("hub.featured")}
              </h2>
              <CtaButton href="/systems/products" variant="ghost">
                {t("hub.browseAll")}
              </CtaButton>
            </div>
            <CardGrid columns={3}>
              {items.map((p) => (
                <SoftwareCard key={String(p._id)} product={p} locale={l} />
              ))}
            </CardGrid>
          </Container>
        </section>
      )}

      {/* Custom-solution lead band */}
      <section
        style={{
          background: "var(--color-surface-2)",
          paddingBlock: "clamp(40px, 5vw, 80px)",
        }}
      >
        <Container
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "var(--s-4)",
            maxWidth: 680,
          }}
        >
          <h2
            style={{
              fontSize: "var(--fs-h3)",
              color: "var(--color-text-strong)",
            }}
          >
            {t("hub.customTitle")}
          </h2>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--fs-body-lg)",
            }}
          >
            {t("hub.customLede")}
          </p>
          <CtaButton href="/systems/custom">
            {t("hub.requestSolution")}
          </CtaButton>
        </Container>
      </section>
    </>
  );
}
