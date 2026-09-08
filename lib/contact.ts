/**
 * Single source of truth for Spiber Med's public contact details and offices.
 *
 * The values here are pulled from the existing site footer + utility bar (the
 * real, confirmed contact info) — NOT from any mockup. The `OFFICES` array is
 * config-driven: the location switcher, the map, the active office detail card,
 * and the office-cards row on the Contact page all render from it, so adding a
 * third office later is a single entry — no layout changes.
 *
 * Localized fields use the project's `{ en, bn }` content convention so the
 * whole array stays in one place and one entry adds a fully bilingual office.
 */

export type Localized = { en: string; bn: string };

export type Office = {
  id: string;
  /** Short label for the location-switcher pill (e.g. "Banani, Dhaka"). */
  shortName: Localized;
  /** Full office name on the detail + cards (e.g. "Spiber Med — Head Office"). */
  name: Localized;
  /** Address, rendered on its own lines (use "\n" to break). */
  address: Localized;
  /** Display phone (spaced for readability). */
  phone: string;
  /** Digits-only phone for the `tel:` href. */
  phoneHref: string;
  email: string;
  hours: Localized;
  /**
   * Approximate centre of the office's area (NOT a surveyed rooftop point).
   * Used to center a keyless, marker-less Google Maps embed so the map shows
   * the general area without dropping confusing search-result pins.
   * TODO: refine to the exact building coordinates when the client confirms.
   */
  lat: number;
  lng: number;
  /** Embed zoom level (higher = closer). */
  zoom?: number;
  /** Named place query for the "Get directions" deep-link destination. */
  mapsQuery: string;
  /**
   * Whether to render the embedded Google Map for this office. Per the client,
   * only the Dhaka head office shows a map; regional offices show the address +
   * a "Get directions" link instead.
   */
  showMap?: boolean;
  /** Internal note for fields still awaiting client confirmation. */
  note?: string;
};

export const OFFICES: Office[] = [
  {
    id: "banani",
    shortName: { en: "Spiber Med Office", bn: "ঢাকা কার্যালয়" },
    name: {
      en: "Spiber Med — Head Office (Dhaka)",
      bn: "স্পাইবার মেড — প্রধান কার্যালয় (ঢাকা)",
    },
    address: {
      en: "Road-06, House-47, Level-01, Block-C,\nBanani, Dhaka-1213, Bangladesh",
      bn: "Road-06, House-47, Level-01, Block-C,\nবনানী, ঢাকা-১২১৩, বাংলাদেশ",
    },
    phone: "+880 1346 092798",
    phoneHref: "+8801346092798",
    email: "info@spibermed.com",
    hours: {
      en: "Mon–Sat · 09:00–18:00 (BST)",
      bn: "সোম–শনি · ০৯:০০–১৮:০০ (BST)",
    },
    lat: 23.793,
    lng: 90.406,
    zoom: 15,
    mapsQuery: "House 47, Road 6, Block C, Banani, Dhaka 1213, Bangladesh",
    showMap: true,
  },
  {
    id: "chittagong",
    shortName: {
      en: "Regional Office (South-East)",
      bn: "আঞ্চলিক · দক্ষিণ-পূর্ব",
    },
    name: {
      en: "Spiber Med — Regional Office (South-East)",
      bn: "স্পাইবার মেড — আঞ্চলিক কার্যালয় (দক্ষিণ-পূর্ব)",
    },
    address: {
      en: "Summer Hill, House-2226/2641,\nPanchlaish, Chittagong-4211, Bangladesh",
      bn: "Summer Hill, House-2226/2641,\nপাঁচলাইশ, চট্টগ্রাম-৪২১১, বাংলাদেশ",
    },
    // TODO: confirm the Chittagong regional office's DIRECT phone, email, and
    // opening hours with the client. The footer lists only one shared phone +
    // the general inbox, so these mirror the head office until confirmed.
    phone: "+880 1346 092798",
    phoneHref: "+8801346092798",
    email: "info@spibermed.com",
    hours: {
      en: "Mon–Sat · 09:00–18:00 (BST)",
      bn: "সোম–শনি · ০৯:০০–১৮:০০ (BST)",
    },
    lat: 22.3607,
    lng: 91.8246,
    zoom: 14,
    mapsQuery: "Panchlaish, Chittagong 4211, Bangladesh",
    note: "TODO: confirm regional office direct phone, email, and hours.",
  },
];

/**
 * Registered identity used on printed documents (invoices). Kept beside the
 * office data so there is one source of truth for "who is billing you".
 *
 * TODO(client): confirm the VAT registration (BIN) and taxpayer (TIN) numbers.
 * Until they are filled in the invoice prints an em dash rather than a guess.
 */
/**
 * Registration details printed on invoices.
 *
 * The BIN is taken from the company's own commercial invoice
 * (SPIBER/EWMCH/14-8/26-714). The TIN has not been supplied yet, and an empty
 * value simply prints a dash rather than a wrong number.
 */
export const LEGAL = {
  name: "SPIBER MED LIMITED",
  bin: "009272672-0109",
  tin: "",
} as const;

/**
 * Where a client pays. Printed on every invoice, taken from the company's own
 * invoice template.
 *
 * ⚠ These are real banking details on a client-facing document. Change them
 * here and nowhere else, and check them before a billing run.
 */
export const BANK = {
  bankName: "Eastern Bank PLC",
  accountName: "SPIBER MED LIMITED",
  accountNo: "1191 0700 06762",
  branch: "Uttara Sonargaon Janapath Branch",
  routingNo: "0952 646 93",
  mobileFinance: "+880-1346-092-798 (B-Kash)",
} as const;

/** Shared contact channels for the "quicker way to reach us" strip + emails. */
export const CONTACT = {
  /** Primary public inbox (from the footer / utility bar). */
  generalEmail: "info@spibermed.com",
  salesEmail: "sales@spibermed.com",
  inquiryEmail: "info@spibermed.com",
  phone: "+880 1346 092798",
  phoneHref: "+8801346092798",
} as const;

/**
 * Keyless Google Maps embed centered on a coordinate. Using `ll` (not `q`)
 * shows the surrounding area WITHOUT dropping a marker / search-result pins —
 * a clean general-location snapshot, no API key needed.
 */
export function mapEmbedUrl(lat: number, lng: number, zoom = 15): string {
  return `https://www.google.com/maps?ll=${lat},${lng}&z=${zoom}&output=embed`;
}

/** Google Maps directions to a place, opened in a new tab. */
export function mapDirectionsUrl(query: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}
