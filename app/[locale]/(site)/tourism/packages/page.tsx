import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { TourismTabs } from "@/components/layout/section-tabs";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { CatalogCard } from "@/components/ui/catalog-card";
import { LiveSearch } from "@/components/ui/live-search";
import { listPackages } from "@/lib/repositories/packages.repo";
import { localize } from "@/lib/schemas/localized";
import { costRangeLabel } from "@/lib/tourism/format";
import { tourismHero } from "@/lib/hero-images";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { TreatmentCategory } from "@/lib/schemas/tourism-catalog";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

const CATEGORIES: TreatmentCategory[] = [
  "cardiac",
  "ortho",
  "neuro",
  "oncology",
  "ivf",
  "cosmetic",
  "health-check",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "tourism.sections.packages",
  });
  return pageMetadata({
    locale: locale as Locale,
    path: "/tourism/packages",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function PackagesPage({
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
  const category = str(sp.category) as TreatmentCategory | undefined;
  const page = Math.max(1, parseInt(str(sp.page) ?? "1", 10) || 1);
  const hasFilter = Boolean(q || category);

  let result: Awaited<ReturnType<typeof listPackages>> = {
    items: [],
    total: 0,
    page,
    pageSize: 24,
    pages: 1,
  };
  try {
    result = await listPackages({
      status: "active",
      search: q,
      category: CATEGORIES.includes(category as TreatmentCategory)
        ? category
        : undefined,
      page,
    });
  } catch (e) {
    logger.warn("packages load failed", e);
  }

  const catHref = (c?: TreatmentCategory) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (c) p.set("category", c);
    const qs = p.toString();
    return qs ? `/tourism/packages?${qs}` : "/tourism/packages";
  };

  return (
    <>
      <PageHeader
        eyebrow={nav("tourism")}
        title={t("sections.packages.title")}
        description={t("sections.packages.lede")}
        image={tourismHero("packages")}
        imageAlt={t("sections.packages.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("tourism"), href: "/tourism" },
          { label: t("sections.packages.title") },
        ]}
      />
      <TourismTabs />
      {result.total === 0 && !hasFilter ? (
        <ComingSoon />
      ) : (
        <Section>
          <Container style={{ display: "grid", gap: "var(--s-6)" }}>
            <LiveSearch
              placeholder={t("sections.packages.title")}
              ariaLabel={t("sections.packages.title")}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={catHref(undefined)} style={pill(!category)}>
                {t("filters.all")}
              </Link>
              {CATEGORIES.map((c) => (
                <Link key={c} href={catHref(c)} style={pill(category === c)}>
                  {c.replace(/-/g, " ")}
                </Link>
              ))}
            </div>
            {result.items.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>
                {t("filters.noResults")}
              </p>
            ) : (
              <CardGrid columns={3}>
                {result.items.map((p) => (
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
                        {costRangeLabel(p.costRange, l) ?? t("cost.onRequest")}
                      </span>
                    }
                    action={t("package.view")}
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

function pill(active: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: "var(--r-pill)",
    border: "1px solid var(--color-border)",
    background: active ? "var(--color-secondary)" : "var(--color-surface)",
    color: active ? "#fff" : "var(--color-text)",
    fontSize: "var(--fs-caption)",
    textTransform: "capitalize",
    fontWeight: 600,
    textDecoration: "none",
  };
}
