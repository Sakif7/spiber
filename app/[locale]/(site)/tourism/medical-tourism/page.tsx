import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionTitle } from "@/components/ui/section-title";
import { PageHeader } from "@/components/ui/page-header";
import { TourismTabs } from "@/components/layout/section-tabs";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { CatalogCard } from "@/components/ui/catalog-card";
import { CtaButton } from "@/components/ui/cta-button";
import { listDestinations } from "@/lib/repositories/destinations.repo";
import { listPackages } from "@/lib/repositories/packages.repo";
import { localize } from "@/lib/schemas/localized";
import { costRangeLabel } from "@/lib/tourism/format";
import { tourismHero } from "@/lib/hero-images";
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
  const t = await getTranslations({
    locale,
    namespace: "tourism.sections.medicalTourism",
  });
  return pageMetadata({
    locale: locale as Locale,
    path: "/tourism/medical-tourism",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function MedicalTourismPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "tourism" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  let destinations: Awaited<ReturnType<typeof listDestinations>>["items"] = [];
  let packages: Awaited<ReturnType<typeof listPackages>>["items"] = [];
  try {
    const [d, p] = await Promise.all([
      listDestinations({ status: "active", pageSize: 9 }),
      listPackages({ status: "active", pageSize: 6 }),
    ]);
    destinations = d.items;
    packages = p.items;
  } catch (e) {
    logger.warn("medical-tourism load failed", e);
  }

  const empty = destinations.length === 0 && packages.length === 0;

  return (
    <>
      <PageHeader
        eyebrow={nav("tourism")}
        title={t("sections.medicalTourism.title")}
        description={t("sections.medicalTourism.lede")}
        image={tourismHero("medical-tourism")}
        imageAlt={t("sections.medicalTourism.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("tourism"), href: "/tourism" },
          { label: t("sections.medicalTourism.title") },
        ]}
      />
      <TourismTabs />

      {empty ? (
        <ComingSoon />
      ) : (
        <>
          {destinations.length > 0 && (
            <Section>
              <Container>
                <SectionTitle
                  title={t("sections.destinations.title")}
                  lede={t("sections.destinations.lede")}
                />
                <CardGrid columns={3}>
                  {destinations.map((d) => (
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
              </Container>
            </Section>
          )}

          {packages.length > 0 && (
            <Section mesh>
              <Container>
                <SectionTitle
                  title={t("sections.packages.title")}
                  lede={t("sections.packages.lede")}
                />
                <CardGrid columns={3}>
                  {packages.map((p) => (
                    <CatalogCard
                      key={String(p._id)}
                      href={`/tourism/package/${p.slug}`}
                      image={null}
                      imageAlt={localize(p.name, l)}
                      placeholderLabel={localize(p.name, l)}
                      placeholderTone="orange"
                      topLabel={p.category.replace(/-/g, " ")}
                      title={localize(p.name, l)}
                      footerLeft={
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {costRangeLabel(p.costRange, l) ??
                            t("cost.onRequest")}
                        </span>
                      }
                      action={t("package.view")}
                    />
                  ))}
                </CardGrid>
              </Container>
            </Section>
          )}
        </>
      )}

      <Section dark>
        <Container
          style={{
            display: "grid",
            gap: "var(--s-5)",
            justifyItems: "center",
            textAlign: "center",
          }}
        >
          <SectionTitle
            dark
            align="center"
            title={t("hub.startCase")}
            lede={t("case.lede")}
          />
          <CtaButton href="/tourism/request-consultation">
            {t("hub.startCase")}
          </CtaButton>
        </Container>
      </Section>
    </>
  );
}
