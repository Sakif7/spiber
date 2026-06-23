import { siteConfig } from "@/lib/site-config";
import { CONTACT, OFFICES } from "@/lib/contact";
import type { Locale } from "@/i18n/routing";

const ORG_ID = `${siteConfig.url}/#organization`;
const LOGO = `${siteConfig.url}/spibermed-logo.png`;

/** Organization structured data for the site (rendered via <JsonLd/>). */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: siteConfig.brand,
    url: siteConfig.url,
    logo: LOGO,
    image: LOGO,
    email: CONTACT.generalEmail,
    telephone: CONTACT.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: OFFICES[0].address.en.replace(/\n/g, ", "),
      addressCountry: "BD",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: CONTACT.phone,
      email: CONTACT.generalEmail,
      contactType: "customer service",
      areaServed: "BD",
      availableLanguage: ["en", "bn"],
    },
  };
}

/** WebSite node with a SearchAction (enables a sitelinks searchbox). */
export function websiteJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    name: siteConfig.brand,
    url: `${siteConfig.url}/${locale}`,
    inLanguage: locale,
    publisher: { "@id": ORG_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/${locale}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * MedicalBusiness node(s) — one per office — with consistent NAP, geo, and
 * opening hours. Returns an array (valid as a single JSON-LD graph script).
 */
export function localBusinessJsonLd(locale: Locale) {
  const lang: "en" | "bn" = locale === "bn" ? "bn" : "en";
  return OFFICES.map((o) => ({
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    "@id": `${siteConfig.url}/${locale}/contact#${o.id}`,
    name: o.name[lang],
    image: LOGO,
    url: `${siteConfig.url}/${locale}/contact`,
    telephone: o.phone,
    email: o.email,
    priceRange: "৳৳",
    address: {
      "@type": "PostalAddress",
      streetAddress: o.address[lang].replace(/\n/g, ", "),
      addressCountry: "BD",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: o.lat,
      longitude: o.lng,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      opens: "09:00",
      closes: "18:00",
    },
    parentOrganization: { "@id": ORG_ID },
  }));
}

/** Breadcrumb structured data from an ordered list of {name, url}. */
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
