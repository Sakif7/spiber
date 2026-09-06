import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

import {
  Hero,
  type HeroChip,
  type HeroLiveChips,
} from "@/components/sections/hero";
import { Pillars } from "@/components/sections/pillars";
import { SkillDevelopment } from "@/components/sections/skill-development";
import { CapitalEquipment } from "@/components/sections/capital-equipment";
import { CSRBand } from "@/components/sections/csr-band";
import { StatsBand } from "@/components/sections/stats-band";
import { Testimonials } from "@/components/sections/testimonials";
import { Management } from "@/components/sections/management";
import { LatestNews } from "@/components/sections/latest-news";
import { CTABand } from "@/components/sections/cta-band";
import { getTestimonials } from "@/lib/services/landing.service";
import {
  listCategoryTree,
  type CategoryNode,
} from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const revalidate = 60;

/**
 * Live chips for the hero bento: the first four top-level Medtrade and Spiber
 * Kart categories (admin order, real slugs) and Kart's health range for the
 * Health Corner tile. Any tile left out here falls back to the static chips in
 * the message catalog, so an empty or unreachable catalogue costs nothing.
 */
async function loadHeroChips(locale: Locale): Promise<HeroLiveChips> {
  const chips: HeroLiveChips = {};
  const toChips = (nodes: CategoryNode[], base: string): HeroChip[] =>
    nodes.slice(0, 4).map((n) => ({
      label: localize(n.name, locale),
      href: `${base}/${n.slug}`,
    }));
  try {
    const [instruments, marketplace] = await Promise.all([
      listCategoryTree("instruments"),
      listCategoryTree("marketplace"),
    ]);
    if (instruments.length) chips.medtrade = toChips(instruments, "/medtrade");
    if (marketplace.length) chips.kart = toChips(marketplace, "/kart/category");
    const health = marketplace.find((n) => n.slug === "health-and-wellness");
    if (health?.children.length)
      chips.health = toChips(health.children, "/kart/category");
  } catch {
    // Catalogue unavailable: the component renders its static chips.
  }
  return chips;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const meta = pageMetadata({
    locale: locale as Locale,
    path: "/",
    title: t("title"),
    description: t("description"),
  });
  // Home keeps its full brand title verbatim (no "%s — Spiber Med" template).
  return { ...meta, title: { absolute: t("title") } };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Admin-managed homepage testimonials (only those with a portrait photo are
  // carousel-ready); falls back to the built-in set when none are configured.
  const [testimonials, heroChips] = await Promise.all([
    getTestimonials("general"),
    loadHeroChips(locale as Locale),
  ]);
  const dbTestimonials = testimonials
    .filter((x) => x.imageSrc)
    .map((x) => ({
      quote: x.quote,
      name: x.name,
      designation: x.role,
      src: x.imageSrc as string,
    }));

  return (
    <>
      <Hero chips={heroChips} />
      <Pillars />
      <SkillDevelopment />
      <CapitalEquipment />
      <CSRBand />
      <StatsBand />
      <Testimonials
        items={dbTestimonials.length ? dbTestimonials : undefined}
      />
      <Management />
      <LatestNews />
      <CTABand />
    </>
  );
}
