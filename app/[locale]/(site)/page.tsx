import { setRequestLocale } from "next-intl/server";

import { JsonLd } from "@/components/ui/json-ld";
import { organizationJsonLd } from "@/lib/seo/jsonld";

import { Hero } from "@/components/sections/hero";
import { Pillars } from "@/components/sections/pillars";
import { SkillDevelopment } from "@/components/sections/skill-development";
import { CapitalEquipment } from "@/components/sections/capital-equipment";
import { CSRBand } from "@/components/sections/csr-band";
import { StatsBand } from "@/components/sections/stats-band";
import { Testimonials } from "@/components/sections/testimonials";
import { Management } from "@/components/sections/management";
import { LatestNews } from "@/components/sections/latest-news";
import { CTABand } from "@/components/sections/cta-band";

export const revalidate = 60;

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <Hero />
      <Pillars />
      <SkillDevelopment />
      <CapitalEquipment />
      <CSRBand />
      <StatsBand />
      <Testimonials />
      <Management />
      <LatestNews />
      <CTABand />
    </>
  );
}
