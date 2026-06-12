import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { AppointmentForm } from "@/components/tourism/forms";
import { getActiveDoctorBySlug } from "@/lib/repositories/doctors.repo";
import { pageMetadata } from "@/lib/seo/metadata";
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
  const t = await getTranslations({ locale, namespace: "tourism.appointment" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/tourism/telemedicine",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function TelemedicinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tourism.appointment" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  // Optional doctor prefill (?doctor=<slug>)
  let doctorId: string | undefined;
  let label: string | undefined;
  const slug = str(sp.doctor);
  if (slug) {
    const doc = await getActiveDoctorBySlug(slug).catch(() => null);
    if (doc) {
      doctorId = String(doc._id);
      label = doc.name;
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("lede")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("tourism"), href: "/tourism" },
          { label: t("title") },
        ]}
      />
      <Section>
        <Container>
          <AppointmentForm doctorId={doctorId} contextLabel={label} />
        </Container>
      </Section>
    </>
  );
}
