import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { CtaButton } from "@/components/ui/cta-button";
import { getActiveHospitalBySlug } from "@/lib/repositories/hospitals.repo";
import { listDoctorsByHospital } from "@/lib/repositories/doctors.repo";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const h = await getActiveHospitalBySlug(slug).catch(() => null);
  return pageMetadata({
    locale: locale as Locale,
    path: `/tourism/hospital/${slug}`,
    title: h ? localize(h.name, locale as Locale) : "Hospital",
    description: h ? localize(h.country, locale as Locale) : "",
  });
}

export default async function HospitalDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "tourism" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const h = await getActiveHospitalBySlug(slug).catch(() => null);
  if (!h) notFound();
  const doctors = await listDoctorsByHospital(String(h._id)).catch(() => []);

  const locationLine = [
    h.city ? localize(h.city, l) : "",
    localize(h.country, l),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader
        eyebrow={locationLine}
        title={localize(h.name, l)}
        description={h.profile ? localize(h.profile, l) : undefined}
        image={h.images?.[0]}
        imageAlt={localize(h.name, l)}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("tourism"), href: "/tourism" },
          { label: t("sections.hospitals.title"), href: "/tourism/hospitals" },
          { label: localize(h.name, l) },
        ]}
      />
      <Section>
        <Container style={{ display: "grid", gap: "var(--s-8)" }}>
          <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
            <CtaButton
              href={`/tourism/request-consultation?hospital=${String(h._id)}&label=${encodeURIComponent(localize(h.name, l))}`}
            >
              {t("hospital.request")}
            </CtaButton>
          </div>

          {h.accreditations?.length > 0 && (
            <Block title={t("hospital.accreditations")}>
              <Chips items={h.accreditations} />
            </Block>
          )}
          {h.specialties?.length > 0 && (
            <Block title={t("hospital.specialties")}>
              <Chips items={h.specialties.map((s) => localize(s, l))} />
            </Block>
          )}

          {doctors.length > 0 && (
            <Block title={t("hospital.doctors")}>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)" }}
              >
                {doctors.map((d) => (
                  <Link
                    key={String(d._id)}
                    href={`/tourism/doctor/${d.slug}`}
                    style={{
                      padding: "8px 14px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--r-pill)",
                      color: "var(--color-text-strong)",
                      textDecoration: "none",
                      fontSize: "var(--fs-body-sm)",
                    }}
                  >
                    {d.name} · {localize(d.specialty, l)}
                  </Link>
                ))}
              </div>
            </Block>
          )}
        </Container>
      </Section>
    </>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--s-3)" }}>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-h3)",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((it, i) => (
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
          {it}
        </span>
      ))}
    </div>
  );
}
