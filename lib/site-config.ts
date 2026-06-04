/**
 * Single source of truth for brand + division names and the public route map.
 * Renaming the parent brand or a division, or adding a public page, is a
 * one-line change here. `key` fields map to `nav.*` message-catalog entries.
 */

export const siteConfig = {
  brand: "Spiber Med",
  domain: "spibermed.com",
  url: process.env.APP_URL ?? "https://spibermed.com",
} as const;

/** The five divisions, in nav order. */
export const divisions = [
  { key: "instruments", href: "/instruments" },
  { key: "academy", href: "/academy" },
  { key: "systems", href: "/systems" },
  { key: "tourism", href: "/tourism" },
  { key: "consulting", href: "/consulting" },
] as const;

export type DivisionKey = (typeof divisions)[number]["key"];

/** Public, indexable top-level routes (used by nav, footer, and sitemap). */
export const publicRoutes = [
  "/",
  "/about",
  "/contact",
  "/marketplace",
  "/instruments",
  "/academy",
  "/systems",
  "/tourism",
  "/consulting",
  "/blog",
  "/privacy",
  "/terms",
  "/refund-shipping",
] as const;
