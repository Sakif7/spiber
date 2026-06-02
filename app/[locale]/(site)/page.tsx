import { setRequestLocale } from "next-intl/server";

import { getLatestPosts } from "@/lib/services/landing.service";
import { JsonLd } from "@/components/ui/json-ld";
import { organizationJsonLd } from "@/lib/seo/jsonld";

import { Hero } from "@/components/sections/hero";
import { Pillars } from "@/components/sections/pillars";
import { BusinessSegments } from "@/components/sections/business-segments";
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

  const posts = await getLatestPosts(6);
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <Hero />
      <Pillars />
      <BusinessSegments />
      <SkillDevelopment />
      <CapitalEquipment />
      <CSRBand />
      <StatsBand />
      <Testimonials />
      <Management />
      <LatestNews initial={posts} />
      <CTABand />
    </>
  );
}
