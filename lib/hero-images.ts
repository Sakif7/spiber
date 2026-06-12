/**
 * Hero background photos for the storefront listing/hub pages. All assets live
 * in /public (local — no next/image remote config needed). Mapped by storefront
 * + category slug, with a sensible per-division fallback so a new category still
 * gets an on-theme image.
 */

const INSTRUMENTS_BY_SLUG: Record<string, string> = {
  "medical-furniture": "/empty-hospital-ward-beds.jpeg",
  "patient-care-monitoring-system":
    "/elderly-patient-bedside-vital-signs-monitor.jpeg",
  "critical-care": "/icu-ventilators-between-hospital-beds.jpeg",
  "or-solution": "/modern-operating-room-equipment.jpeg",
  "surgical-solution": "/surgeons-operating-closeup-with-instruments.jpeg",
  "medical-imaging-system": "/doctor-by-ct-scanner-with-patient.jpeg",
  "in-vitro-diagnostics-lab": "/lab-technician-using-analyzer-machine.jpeg",
};

const MARKETPLACE_BY_SLUG: Record<string, string> = {
  medical: "/modern-operating-room-equipment.jpeg",
  "medical-hospital-furniture": "/hospital-bed-control-panel-closeup.jpeg",
  "medical-patient-monitoring": "/icu-patient-blood-pressure-monitor.jpeg",
  "medical-infusion-syringe-pumps": "/iv-infusion-pump-bedside.jpeg",
  "health-and-wellness": "/nurse-comforting-elderly-woman-home-care.jpeg",
  technology: "/surgeon-viewing-medical-imaging-screen.jpeg",
};

export const HERO = {
  instrumentsHub: "/modern-operating-room-equipment.jpeg",
  systemsHub: "/surgeon-viewing-medical-imaging-screen.jpeg",
  academyHub: "/cpr-training-manikin-with-aed.jpeg",
  tourismHub: "/cherry-blossom-tree-lined-road.jpeg",
  consultingHub: "/smiling-medical-team-portrait.jpeg",
  marketplaceHub: "/diverse-medical-team-cheering.jpeg",
} as const;

/** Rotating hero photos for the two main hub carousels. */
export const INSTRUMENTS_HUB_IMAGES = [
  "/modern-operating-room-equipment.jpeg",
  "/icu-ventilators-between-hospital-beds.jpeg",
  "/c-arm-xray-imaging-system.jpeg",
  "/radiology-technician-by-ct-scanner.jpeg",
];

export const MARKETPLACE_HUB_IMAGES = [
  "/diverse-medical-team-cheering.jpeg",
  "/elderly-patient-bedside-vital-signs-monitor.jpeg",
  "/icu-patient-blood-pressure-monitor.jpeg",
  "/iv-infusion-pump-bedside.jpeg",
];

/** Rotating hero photos for the Spiber Tourism hub. */
export const TOURISM_HUB_IMAGES = [
  "/cherry-blossom-tree-lined-road.jpeg",
  "/smiling-medical-team-portrait.jpeg",
  "/doctor-by-ct-scanner-with-patient.jpeg",
  "/diverse-medical-team-cheering.jpeg",
];

const TOURISM_BY_SECTION: Record<string, string> = {
  doctors: "/smiling-medical-team-portrait.jpeg",
  hospitals: "/modern-operating-room-equipment.jpeg",
  destinations: "/cherry-blossom-tree-lined-road.jpeg",
  packages: "/surgeons-operating-closeup-with-instruments.jpeg",
  "medical-tourism": "/doctor-by-ct-scanner-with-patient.jpeg",
};

/** Hero photo for a Tourism section (falls back to the hub image). */
export function tourismHero(section?: string): string {
  return (section && TOURISM_BY_SECTION[section]) || HERO.tourismHub;
}

/**
 * About / "Who We Are" hero carousel — human-centred brand imagery.
 * TODO: swap these /public placeholders for real Spiber Med photography
 * (clinicians, facility, team) once the client supplies final assets.
 */
export const ABOUT_HERO_IMAGES = [
  "/doctor-intern.png",
  // "/doctor-and-nurse-reviewing-xray-with-patient.jpeg",
  // "/diverse-medical-team-cheering.jpeg",
  // "/nurse-holding-patient-hand-reassurance.jpeg",
];

/** Hero photo for an Instruments category (falls back to the hub image). */
export function instrumentsHero(slug?: string): string {
  return (slug && INSTRUMENTS_BY_SLUG[slug]) || HERO.instrumentsHub;
}

/** Hero photo for a Marketplace category (falls back to the hub image). */
export function marketplaceHero(slug?: string): string {
  return (slug && MARKETPLACE_BY_SLUG[slug]) || HERO.marketplaceHub;
}

/**
 * ── FINE-TUNE HERO FRAMING HERE ──────────────────────────────────────────
 * Hero photos use `object-fit: cover`, so the wide/short hero band crops the
 * top + bottom of each image. To control WHICH part stays visible, set a CSS
 * `object-position` per image below (keyed by its /public path).
 *
 * Format: "<horizontal> <vertical>", values are keywords or %:
 *   "center"        → centred (default)
 *   "top"           → pin the TOP edge (shows the top, crops the bottom)
 *   "bottom"        → pin the bottom (shows the bottom, crops the top)
 *   "center 30%"    → bias UP a bit (0% = top, 50% = middle, 100% = bottom)
 *   "center 70%"    → bias DOWN a bit
 *
 * If a photo is "cut off at the top", lower the vertical value (try "top",
 * then "center 20%", "center 30%") until the subject is framed. Anything not
 * listed defaults to "center".
 */
const POSITIONS: Record<string, string> = {
  // Instruments hub carousel
  "/modern-operating-room-equipment.jpeg": "center",
  "/icu-ventilators-between-hospital-beds.jpeg": "center 20%",
  "/c-arm-xray-imaging-system.jpeg": "center 50%",
  "/radiology-technician-by-ct-scanner.jpeg": "center 35%",
  // Marketplace hub carousel
  "/diverse-medical-team-cheering.jpeg": "center 25%",
  "/elderly-patient-bedside-vital-signs-monitor.jpeg": "center 40%",
  "/icu-patient-blood-pressure-monitor.jpeg": "center 40%",
  "/iv-infusion-pump-bedside.jpeg": "center 40%",
  // Category / other hub photos
  "/empty-hospital-ward-beds.jpeg": "center",
  "/surgeons-operating-closeup-with-instruments.jpeg": "center 40%",
  "/doctor-by-ct-scanner-with-patient.jpeg": "center 35%",
  "/nurse-comforting-elderly-woman-home-care.jpeg": "center 30%",
  "/surgeon-viewing-medical-imaging-screen.jpeg": "center 35%",
  "/smiling-medical-team-portrait.jpeg": "center 25%",
  "/cpr-training-manikin-with-aed.jpeg": "center 35%",
  "/cherry-blossom-tree-lined-road.jpeg": "center 40%",
  // About hero carousel
  // "/doctor-and-nurse-reviewing-xray-with-patient.jpeg": "center 30%",
  // "/nurse-holding-patient-hand-reassurance.jpeg": "center 35%",
  "/doctor-intern.png": "center 20%",
};

/** CSS object-position for a hero image (see POSITIONS above). */
export function heroPosition(src: string): string {
  return POSITIONS[src] ?? "center";
}
