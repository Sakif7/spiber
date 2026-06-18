/**
 * Spiber Med managing body — single source of truth for the homepage
 * `Management` section and the dedicated `/company/team` page.
 *
 * Names + photos live here (proper nouns / assets — not localized); the
 * matching role + bio are localized in `home.management.members` and are
 * **index-aligned** with this array, so keep the two in the same order.
 *
 * Note: a "Chief Advisor" (Prof. Dr. Md. Moazzem Hossain,
 * `/moazzem-testimonial.jpg`) was hidden per request. To re-enable, add the
 * entry back here AND restore the matching object at the same index in
 * `home.management.members` of every `messages/*.json` so the arrays realign.
 */
export type TeamMemberBase = {
  /** Full name — a proper noun, intentionally not localized. */
  name: string;
  /** Portrait under /public. */
  image: string;
};

export const TEAM_MEMBERS: TeamMemberBase[] = [
  { name: "Morsheda Parvin Misti", image: "/mishti-managing-body.jpeg" },
  { name: "Dr. Md Jahidul Islam", image: "/jahidul-managing-body.png" },
  { name: "Mostary Morshed Smriti", image: "/smriti-managing-body.png" },
  { name: "Subrina Azmi Kanta", image: "/kanta-managing-body.jpeg" },
  { name: "Md Saadman Sakif", image: "/sakif-managing-body.jpeg" },
];
