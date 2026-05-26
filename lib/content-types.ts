/**
 * Shared content shapes for sections whose data is hydrated from MongoDB
 * (testimonials, news posts). Lives outside `components/` so server routes,
 * page-level loaders, and individual section files can all import the same
 * type without crossing client/server boundaries.
 */

export type Tone = "teal" | "orange" | "slate";

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  tone: Tone;
};

export type Post = {
  kicker: string;
  title: string;
  excerpt: string;
  date: string;
  read: string;
  tone: Tone;
  placeholder: string;
};
