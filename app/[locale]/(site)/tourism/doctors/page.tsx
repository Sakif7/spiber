import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { CatalogCard } from "@/components/ui/catalog-card";
import { LiveSearch } from "@/components/ui/live-search";
import { listDoctors } from "@/lib/repositories/doctors.repo";
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
    namespace: "tourism.sections.doctors",
  });
  return pageMetadata({
    locale: locale as Locale,
    path: "/tourism/doctors",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function DoctorsPage({
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
  const online = sp.online === "1";
  const page = Math.max(1, parseInt(str(sp.page) ?? "1", 10) || 1);
  const hasFilter = Boolean(q || online);

  let result: Awaited<ReturnType<typeof listDoctors>> = {
    items: [],
    total: 0,
    page,
    pageSize: 24,
    pages: 1,
  };
  try {
    result = await listDoctors({
      status: "active",
      search: q,
      onlineConsultation: online || undefined,
      page,
    });
  } catch (e) {
    logger.warn("doctors load failed", e);
  }

  const toggleOnline = online
    ? `/tourism/doctors${q ? `?q=${encodeURIComponent(q)}` : ""}`
    : `/tourism/doctors?online=1${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHeader
        eyebrow={t("hub.findDoctor")}
        title={t("sections.doctors.title")}
        description={t("sections.doctors.lede")}
        image={tourismHero("doctors")}
        imageAlt={t("sections.doctors.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("tourism"), href: "/tourism" },
          { label: t("sections.doctors.title") },
        ]}
      />
      {result.total === 0 && !hasFilter ? (
        <ComingSoon />
      ) : (
        <Section>
          <Container style={{ display: "grid", gap: "var(--s-6)" }}>
            <div
              style={{
                display: "flex",
                gap: "var(--s-3)",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }}>
                <LiveSearch
                  placeholder={t("hub.searchDoctors")}
                  ariaLabel={t("hub.searchDoctors")}
                />
              </div>
              <Link
                href={toggleOnline}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--r-pill)",
                  border: "1px solid var(--color-border)",
                  background: online
                    ? "var(--color-secondary)"
                    : "var(--color-surface)",
                  color: online ? "#fff" : "var(--color-text)",
                  fontSize: "var(--fs-caption)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {t("filters.online")}
              </Link>
            </div>

            {result.items.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>
                {t("filters.noResults")}
              </p>
            ) : (
              <CardGrid columns={3}>
                {result.items.map((d) => (
                  <CatalogCard
                    key={String(d._id)}
                    href={`/tourism/doctor/${d.slug}`}
                    image={d.photo}
                    imageAlt={d.name}
                    placeholderLabel={d.name}
                    placeholderTone="orange"
                    topLabel={
                      d.onlineConsultation ? t("doctor.online") : undefined
                    }
                    title={d.name}
                    subLabel={
                      <span
                        style={{
                          color: "var(--color-text-muted)",
                          fontSize: 13,
                        }}
                      >
                        {localize(d.specialty, l)}
                      </span>
                    }
                    action={t("doctor.view")}
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
