import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionTitle } from "@/components/ui/section-title";
import { CaseForm } from "@/components/tourism/forms";
import { TourismTabs } from "@/components/layout/section-tabs";
import {
  TourismHero,
  ServiceOverview,
  FeaturedDestinations,
  PopularTreatments,
  HowItWorks,
  TravelSupport,
  WhyChoose,
  CareManagerCard,
  PatientStories,
} from "@/components/tourism/hub";
import { namespaceMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(locale as Locale, "hubs.tourism", "/tourism");
}

export default async function TourismHub({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tourism.consult" });

  return (
    <>
      <TourismHero />
      <TourismTabs />
      <ServiceOverview />
      <FeaturedDestinations />
      <PopularTreatments />
      <HowItWorks />
      <TravelSupport />
      <WhyChoose />

      {/* Request a consultation + care-manager rail */}
      <Section>
        <Container>
          <SectionTitle title={t("heading")} lede={t("lede")} />
          <div
            className="equal-2col"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, .8fr)",
              gap: "var(--s-6)",
              alignItems: "start",
              marginTop: "var(--s-6)",
            }}
          >
            <CaseForm />
            <CareManagerCard />
          </div>
        </Container>
      </Section>

      <PatientStories />
    </>
  );
}
