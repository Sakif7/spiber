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
  "/lab-technician-using-analyzer-machine.jpeg",
];

export const MARKETPLACE_HUB_IMAGES = [
  "/diverse-medical-team-cheering.jpeg",
  "/hospital-bed-control-panel-closeup.jpeg",
  "/icu-patient-blood-pressure-monitor.jpeg",
  "/iv-infusion-pump-bedside.jpeg",
];

/** Hero photo for an Instruments category (falls back to the hub image). */
export function instrumentsHero(slug?: string): string {
  return (slug && INSTRUMENTS_BY_SLUG[slug]) || HERO.instrumentsHub;
}

/** Hero photo for a Marketplace category (falls back to the hub image). */
export function marketplaceHero(slug?: string): string {
  return (slug && MARKETPLACE_BY_SLUG[slug]) || HERO.marketplaceHub;
}
