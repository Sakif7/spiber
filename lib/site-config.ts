/**
 * Single source of truth for brand + division names and the public route map.
 * Renaming the parent brand or a division, or adding a public page, is a
 * one-line change here. `key` fields map to `nav.*` message-catalog entries.
 */

/**
 * Normalize the configured public base URL into a clean absolute origin
 * (scheme + host, no trailing slash). Resilient to a misconfigured `APP_URL`:
 * a single-slash "https:/host" typo, a trailing slash, or an empty value all
 * resolve to a well-formed origin. Every consumer builds links as
 * `${siteConfig.url}${path}` (path starts with "/"), so a trailing-slash-free
 * origin keeps sitemap/canonical/OG/RSS/email URLs correct.
 */
function resolveSiteUrl(): string {
  const fallback = "https://spibermed.com";
  const raw = process.env.APP_URL?.trim() || fallback;
  try {
    return new URL(raw).origin;
  } catch {
    return fallback;
  }
}

export const siteConfig = {
  brand: "Spiber Med",
  domain: "spibermed.com",
  url: resolveSiteUrl(),
} as const;

/** The five divisions, in nav order. */
export const divisions = [
  { key: "instruments", href: "/medtrade" },
  { key: "academy", href: "/medacademy" },
  { key: "systems", href: "/digihealth" },
  { key: "tourism", href: "/tourism" },
  { key: "health-corner", href: "/health-corner" },
] as const;

export type DivisionKey = (typeof divisions)[number]["key"];

/** Public, indexable top-level routes (used by nav, footer, and sitemap). */
export const publicRoutes = [
  "/",
  "/company/about",
  "/company/corporate-philosophy",
  "/company/vision-2040",
  "/company/career",
  "/company/gallery",
  "/company/events",
  "/contact",
  "/kart",
  "/kart/shop",
  "/kart/brands",
  "/kart/request-product",
  "/become-a-seller",
  "/medtrade",
  "/medacademy",
  "/digihealth",
  "/tourism",
  "/tourism/medical-tourism",
  "/tourism/destinations",
  "/tourism/hospitals",
  "/tourism/doctors",
  "/tourism/packages",
  "/tourism/telemedicine",
  "/tourism/air-tickets",
  "/tourism/hotels",
  "/tourism/visa",
  "/tourism/partner",
  "/health-corner",
  "/blog",
  "/privacy",
  "/terms",
  "/refund-shipping",
] as const;
