import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHeader } from "@/components/ui/page-header";
import { CaseForm } from "@/components/tourism/forms";
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
  const t = await getTranslations({ locale, namespace: "tourism.case" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/tourism/request-consultation",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function RequestConsultationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tourism.case" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const hospitalId = str(sp.hospital);
  const doctorId = str(sp.doctor);
  const packageId = str(sp.package);
  const label = str(sp.label);
  const contextLabel = label
    ? `${doctorId ? t("forDoctor") : packageId ? t("forPackage") : t("forHospital")} ${label}`
    : undefined;

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
          <CaseForm
            hospitalId={hospitalId}
            doctorId={doctorId}
            packageId={packageId}
            contextLabel={contextLabel}
          />
        </Container>
      </Section>
    </>
  );
}
