import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { CatalogCard } from "@/components/ui/catalog-card";
import { LiveSearch } from "@/components/ui/live-search";
import { listHospitals } from "@/lib/repositories/hospitals.repo";
import { localize } from "@/lib/schemas/localized";
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
    namespace: "tourism.sections.hospitals",
  });
  return pageMetadata({
    locale: locale as Locale,
    path: "/tourism/hospitals",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function HospitalsPage({
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

  let result: Awaited<ReturnType<typeof listHospitals>> = {
    items: [],
    total: 0,
    page,
    pageSize: 24,
    pages: 1,
  };
  try {
    result = await listHospitals({ status: "active", search: q, page });
  } catch (e) {
    logger.warn("hospitals load failed", e);
  }

  return (
    <>
      <PageHeader
        eyebrow={t("hub.findHospital")}
        title={t("sections.hospitals.title")}
        description={t("sections.hospitals.lede")}
        image={tourismHero("hospitals")}
        imageAlt={t("sections.hospitals.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("tourism"), href: "/tourism" },
          { label: t("sections.hospitals.title") },
        ]}
      />
      {result.total === 0 && !q ? (
        <ComingSoon />
      ) : (
        <Section>
          <Container style={{ display: "grid", gap: "var(--s-6)" }}>
            <LiveSearch
              placeholder={t("hub.searchHospitals")}
              ariaLabel={t("hub.searchHospitals")}
            />
            {result.items.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>
                {t("filters.noResults")}
              </p>
            ) : (
              <CardGrid columns={3}>
                {result.items.map((h) => (
                  <CatalogCard
                    key={String(h._id)}
                    href={`/tourism/hospital/${h.slug}`}
                    image={h.images?.[0]}
                    imageAlt={localize(h.name, l)}
                    placeholderLabel={localize(h.name, l)}
                    placeholderTone="orange"
                    topLabel={localize(h.country, l)}
                    title={localize(h.name, l)}
                    subLabel={
                      h.accreditations?.length ? (
                        <span
                          style={{
                            color: "var(--color-text-muted)",
                            fontSize: 13,
                          }}
                        >
                          {h.accreditations.slice(0, 3).join(" · ")}
                        </span>
                      ) : undefined
                    }
                    action={t("hospital.view")}
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
