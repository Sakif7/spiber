import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { CtaButton } from "@/components/ui/cta-button";
import { Placeholder } from "@/components/ui/placeholder";
import { getActiveDoctorBySlug } from "@/lib/repositories/doctors.repo";
import { getHospitalByIdLean } from "@/lib/repositories/hospitals.repo";
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
  const doc = await getActiveDoctorBySlug(slug).catch(() => null);
  return pageMetadata({
    locale: locale as Locale,
    path: `/tourism/doctor/${slug}`,
    title: doc?.name ?? "Doctor",
    description: doc ? localize(doc.specialty, locale as Locale) : "",
  });
}

export default async function DoctorDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "tourism" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const doc = await getActiveDoctorBySlug(slug).catch(() => null);
  if (!doc) notFound();
  const hospital = doc.hospitalId
    ? await getHospitalByIdLean(String(doc.hospitalId)).catch(() => null)
    : null;

  return (
    <>
      <PageHeader
        eyebrow={localize(doc.specialty, l)}
        title={doc.name}
        description={doc.location ? localize(doc.location, l) : undefined}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("tourism"), href: "/tourism" },
          { label: t("sections.doctors.title"), href: "/tourism/doctors" },
          { label: doc.name },
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
          <div style={{ display: "grid", gap: "var(--s-5)" }}>
            <div
              style={{
                position: "relative",
                height: 280,
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
              }}
            >
              {doc.photo ? (
                <Image
                  src={doc.photo}
                  alt={doc.name}
                  fill
                  sizes="(max-width:768px) 100vw, 640px"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <Placeholder
                  label={doc.name}
                  tone="orange"
                  style={{ width: "100%", height: "100%" }}
                />
              )}
            </div>
            {doc.bio && (
              <div>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--fs-h3)",
                  }}
                >
                  {t("doctor.about")}
                </h2>
                <p
                  style={{
                    color: "var(--color-text)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-line",
                  }}
                >
                  {localize(doc.bio, l)}
                </p>
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
            <Row
              label={t("doctor.specialty")}
              value={localize(doc.specialty, l)}
            />
            {hospital && (
              <Row
                label={t("doctor.hospital")}
                value={localize(hospital.name, l)}
              />
            )}
            {doc.onlineConsultation && (
              <span
                style={{
                  color: "var(--color-secondary)",
                  fontWeight: 600,
                  fontSize: "var(--fs-body-sm)",
                }}
              >
                ● {t("doctor.online")}
              </span>
            )}
            {doc.onlineConsultation && (
              <CtaButton href={`/tourism/telemedicine?doctor=${doc.slug}`}>
                {t("appointment.title")}
              </CtaButton>
            )}
            <CtaButton
              href={`/tourism/request-consultation?doctor=${String(doc._id)}&label=${encodeURIComponent(doc.name)}`}
              variant={doc.onlineConsultation ? "secondary" : "primary"}
            >
              {t("doctor.book")}
            </CtaButton>
          </aside>
        </Container>
      </Section>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--s-3)",
      }}
    >
      <span
        style={{
          color: "var(--color-text-muted)",
          fontSize: "var(--fs-body-sm)",
        }}
      >
        {label}
      </span>
      <strong style={{ color: "var(--color-text-strong)", textAlign: "right" }}>
        {value}
      </strong>
    </div>
  );
}
