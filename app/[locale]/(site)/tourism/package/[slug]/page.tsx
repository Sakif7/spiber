import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { JsonLd } from "@/components/ui/json-ld";
import { CtaButton } from "@/components/ui/cta-button";
import { getActivePackageBySlug } from "@/lib/repositories/packages.repo";
import { getHospitalsByIds } from "@/lib/repositories/hospitals.repo";
import { localize } from "@/lib/schemas/localized";
import { costRangeLabel } from "@/lib/tourism/format";
import { tourismHero } from "@/lib/hero-images";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { siteConfig } from "@/lib/site-config";
import { localePath } from "@/lib/i18n/intl-locale";
import { Check } from "lucide-react";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const p = await getActivePackageBySlug(slug).catch(() => null);
  return pageMetadata({
    locale: locale as Locale,
    path: `/tourism/package/${slug}`,
    title: p ? localize(p.name, locale as Locale) : "Package",
    description: p?.description
      ? localize(p.description, locale as Locale)
      : "",
  });
}

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const localeBase = siteConfig.url + localePath(l, "/").replace(/\/$/, "");
  const t = await getTranslations({ locale, namespace: "tourism" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const p = await getActivePackageBySlug(slug).catch(() => null);
  if (!p) notFound();
  const hospitals = p.hospitalOptionIds?.length
    ? await getHospitalsByIds(p.hospitalOptionIds.map(String)).catch(() => [])
    : [];
  const cost = costRangeLabel(p.costRange, l);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: nav("home"), url: `${localeBase}` },
          { name: nav("tourism"), url: `${localeBase}/tourism` },
          {
            name: t("sections.packages.title"),
            url: `${localeBase}/tourism/packages`,
          },
          {
            name: localize(p.name, l),
            url: `${localeBase}/tourism/package/${slug}`,
          },
        ])}
      />
      <PageHeader
        eyebrow={p.category.replace(/-/g, " ")}
        title={localize(p.name, l)}
        description={p.description ? localize(p.description, l) : undefined}
        image={tourismHero("packages")}
        imageAlt={localize(p.name, l)}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("tourism"), href: "/tourism" },
          { label: t("sections.packages.title"), href: "/tourism/packages" },
          { label: localize(p.name, l) },
        ]}
      />
      <Section>
        <Container
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 320px)",
            gap: "var(--s-8)",
            alignItems: "start",
          }}
          className="equal-2col"
        >
          <div style={{ display: "grid", gap: "var(--s-6)" }}>
            {p.inclusions?.length > 0 && (
              <div style={{ display: "grid", gap: "var(--s-3)" }}>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--fs-h3)",
                    margin: 0,
                  }}
                >
                  {t("package.inclusions")}
                </h2>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {p.inclusions.map((it, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <Check
                        size={18}
                        style={{
                          color: "var(--color-secondary)",
                          marginTop: 2,
                          flexShrink: 0,
                        }}
                        aria-hidden
                      />
                      <span>{localize(it, l)}</span>
                    </li>
                  ))}
                </ul>
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
                  {t("package.hospitals")}
                </h2>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "var(--s-3)",
                  }}
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
          </div>

          <aside
            style={{
              display: "grid",
              gap: "var(--s-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              padding: "var(--s-5)",
              background: "var(--color-surface)",
              position: "sticky",
              top: 96,
            }}
          >
            <span
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--fs-body-sm)",
              }}
            >
              {t("package.estimatedCost")}
            </span>
            <strong
              style={{
                fontSize: "var(--fs-lg)",
                color: "var(--color-text-strong)",
              }}
            >
              {cost ?? t("cost.onRequest")}
            </strong>
            <span
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--fs-caption)",
              }}
            >
              {t("cost.estimate")}
            </span>
            <CtaButton
              href={`/tourism/request-consultation?package=${String(p._id)}&label=${encodeURIComponent(localize(p.name, l))}`}
            >
              {t("package.inquire")}
            </CtaButton>
          </aside>
        </Container>
      </Section>
    </>
  );
}
