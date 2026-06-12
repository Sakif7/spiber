import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { CtaButton } from "@/components/ui/cta-button";
import { getActiveDestinationBySlug } from "@/lib/repositories/destinations.repo";
import { getHospitalsByIds } from "@/lib/repositories/hospitals.repo";
import { localize } from "@/lib/schemas/localized";
import { costRangeLabel } from "@/lib/tourism/format";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const d = await getActiveDestinationBySlug(slug).catch(() => null);
  return pageMetadata({
    locale: locale as Locale,
    path: `/tourism/destination/${slug}`,
    title: d ? localize(d.name, locale as Locale) : "Destination",
    description: d?.overview ? localize(d.overview, locale as Locale) : "",
  });
}

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "tourism" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const d = await getActiveDestinationBySlug(slug).catch(() => null);
  if (!d) notFound();
  const hospitals = d.partnerHospitalIds?.length
    ? await getHospitalsByIds(d.partnerHospitalIds.map(String)).catch(() => [])
    : [];
  const cost = costRangeLabel(d.costRange, l);

  return (
    <>
      <PageHeader
        eyebrow={nav("tourism")}
        title={localize(d.name, l)}
        description={d.overview ? localize(d.overview, l) : undefined}
        image={d.heroImage}
        imageAlt={localize(d.name, l)}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("tourism"), href: "/tourism" },
          {
            label: t("sections.destinations.title"),
            href: "/tourism/destinations",
          },
          { label: localize(d.name, l) },
        ]}
      />
      <Section>
        <Container style={{ display: "grid", gap: "var(--s-8)" }}>
          <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
            <CtaButton
              href={`/tourism/request-consultation?label=${encodeURIComponent(localize(d.name, l))}`}
            >
              {t("destination.request")}
            </CtaButton>
          </div>

          {cost && (
            <div style={{ display: "grid", gap: 4 }}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--fs-h3)",
                  margin: 0,
                }}
              >
                {t("destination.estimatedCost")}
              </h2>
              <strong
                style={{
                  fontSize: "var(--fs-lg)",
                  color: "var(--color-text-strong)",
                }}
              >
                {cost}
              </strong>
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--fs-caption)",
                }}
              >
                {t("cost.estimate")}
              </span>
            </div>
          )}

          {d.popularTreatments?.length > 0 && (
            <div style={{ display: "grid", gap: "var(--s-3)" }}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--fs-h3)",
                  margin: 0,
                }}
              >
                {t("destination.popularTreatments")}
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {d.popularTreatments.map((p, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "var(--r-pill)",
                      background: "var(--color-secondary-soft)",
                      color: "var(--color-text-strong)",
                      fontSize: "var(--fs-caption)",
                      fontWeight: 600,
                    }}
                  >
                    {localize(p, l)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hospitals.length > 0 && (
            <div style={{ display: "grid", gap: "var(--s-3)" }}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--fs-h3)",
                  margin: 0,
                }}
              >
                {t("destination.partnerHospitals")}
              </h2>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)" }}
              >
                {hospitals.map((h) => (
                  <Link
                    key={String(h._id)}
                    href={`/tourism/hospital/${h.slug}`}
                    style={{
                      padding: "8px 14px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--r-pill)",
                      color: "var(--color-text-strong)",
                      textDecoration: "none",
                      fontSize: "var(--fs-body-sm)",
                    }}
                  >
                    {localize(h.name, l)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
