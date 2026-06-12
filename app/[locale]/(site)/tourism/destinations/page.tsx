import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { CatalogCard } from "@/components/ui/catalog-card";
import { LiveSearch } from "@/components/ui/live-search";
import { listDestinations } from "@/lib/repositories/destinations.repo";
import { localize } from "@/lib/schemas/localized";
import { costRangeLabel } from "@/lib/tourism/format";
import { tourismHero } from "@/lib/hero-images";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "tourism.sections.destinations",
  });
  return pageMetadata({
    locale: locale as Locale,
    path: "/tourism/destinations",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function DestinationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "tourism" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const q = str(sp.q);
  const page = Math.max(1, parseInt(str(sp.page) ?? "1", 10) || 1);

  let result: Awaited<ReturnType<typeof listDestinations>> = {
    items: [],
    total: 0,
    page,
    pageSize: 24,
    pages: 1,
  };
  try {
    result = await listDestinations({ status: "active", search: q, page });
  } catch (e) {
    logger.warn("destinations load failed", e);
  }

  return (
    <>
      <PageHeader
        eyebrow={nav("tourism")}
        title={t("sections.destinations.title")}
        description={t("sections.destinations.lede")}
        image={tourismHero("destinations")}
        imageAlt={t("sections.destinations.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("tourism"), href: "/tourism" },
          { label: t("sections.destinations.title") },
        ]}
      />
      {result.total === 0 && !q ? (
        <ComingSoon />
      ) : (
        <Section>
          <Container style={{ display: "grid", gap: "var(--s-6)" }}>
            <LiveSearch
              placeholder={t("sections.destinations.title")}
              ariaLabel={t("sections.destinations.title")}
            />
            {result.items.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>
                {t("filters.noResults")}
              </p>
            ) : (
              <CardGrid columns={3}>
                {result.items.map((d) => (
                  <CatalogCard
                    key={String(d._id)}
                    href={`/tourism/destination/${d.slug}`}
                    image={d.heroImage}
                    imageAlt={localize(d.name, l)}
                    placeholderLabel={localize(d.name, l)}
                    placeholderTone="orange"
                    title={localize(d.name, l)}
                    footerLeft={
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {costRangeLabel(d.costRange, l) ?? ""}
                      </span>
                    }
                    action={t("destination.view")}
                  />
                ))}
              </CardGrid>
            )}
          </Container>
        </Section>
      )}
    </>
  );
}
