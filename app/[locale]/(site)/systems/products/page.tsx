import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { SoftwareCard } from "@/components/systems/software-card";
import { listSoftwareProducts } from "@/lib/repositories/software.repo";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "systems.catalog" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/systems/products",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function SoftwareCatalog({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "systems" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  let items: Awaited<ReturnType<typeof listSoftwareProducts>>["items"] = [];
  let total = 0;
  try {
    const res = await listSoftwareProducts({ status: "active", pageSize: 60 });
    items = res.items;
    total = res.total;
  } catch (e) {
    logger.warn("software catalog load failed", e);
  }

  return (
    <>
      <PageHeader
        eyebrow={t("hub.title")}
        title={t("catalog.title")}
        description={t("catalog.lede")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("hub.title"), href: "/systems" },
          { label: t("catalog.title") },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container style={{ display: "grid", gap: "var(--s-6)" }}>
          {items.length === 0 ? (
            <ComingSoon />
          ) : (
            <>
              <p
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--fs-body-sm)",
                }}
              >
                {t("catalog.results", { count: total })}
              </p>
              <CardGrid columns={3}>
                {items.map((p) => (
                  <SoftwareCard key={String(p._id)} product={p} locale={l} />
                ))}
              </CardGrid>
            </>
          )}
        </Container>
      </section>
    </>
  );
}
