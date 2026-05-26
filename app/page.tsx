import { getDb } from "@/lib/mongodb";
import { CTABand, Footer, StickyHeader, UtilityBar } from "@/components/chrome";
import { Hero } from "@/components/hero";
import {
  BusinessSegments,
  Pillars,
  SkillDevelopment,
} from "@/components/mid-sections";
import {
  CSRBand,
  CapitalEquipment,
  StatsBand,
} from "@/components/low-sections";
import {
  LatestNews,
  Management,
  Testimonials,
  type Post,
  type Testimonial,
} from "@/components/social-sections";

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
