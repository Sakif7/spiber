import { getDb } from "@/lib/mongodb";
import type { Post, Testimonial } from "@/lib/content-types";

import { UtilityBar } from "@/components/layout/utility-bar";
import { StickyHeader } from "@/components/layout/sticky-header";
import { Footer } from "@/components/layout/footer";

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

async function fetchTestimonials(): Promise<Testimonial[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const items = await db
      .collection("testimonials")
      .find({}, { projection: { _id: 0 } })
      .sort({ order: 1 })
      .limit(20)
      .toArray();
    return items as unknown as Testimonial[];
  } catch {
    return [];
  }
}

async function fetchPosts(): Promise<Post[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const items = await db
      .collection("posts")
      .find({}, { projection: { _id: 0 } })
      .sort({ date: -1 })
      .limit(6)
      .toArray();
    return items as unknown as Post[];
  } catch {
    return [];
  }
}

export default async function Home() {
  const [testimonials, posts] = await Promise.all([fetchTestimonials(), fetchPosts()]);
  return (
    <>
      <UtilityBar />
      <StickyHeader />
      <main>
        <Hero />
        <Pillars />
        <BusinessSegments />
        <SkillDevelopment />
        <CapitalEquipment />
        <CSRBand />
        <StatsBand />
        <Testimonials initial={testimonials} />
        <Management />
        <LatestNews initial={posts} />
        <CTABand />
      </main>
      <Footer />
    </>
  );
}
