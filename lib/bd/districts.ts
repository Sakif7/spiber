/**
 * The 64 districts of Bangladesh, with the division each belongs to.
 *
 * A lead's address is one free-text line, so nothing about WHERE a client sits
 * can be got out of it reliably — "94 K.B. Fazlul Kader Rd, Chattogram 4203"
 * and "Ctg." are the same place to a reader and nothing at all to a filter.
 * The district is therefore its own field, chosen from this list.
 *
 * Stored as the `id` slug rather than the label: a label can be respelled
 * (Chittagong → Chattogram, Jessore → Jashore, and most of this list was
 * renamed in 2018) without orphaning every lead already filed under it.
 */

export type Division =
  | "barishal"
  | "chattogram"
  | "dhaka"
  | "khulna"
  | "mymensingh"
  | "rajshahi"
  | "rangpur"
  | "sylhet";

export type District = {
  /** Stored value. Stable; never re-spell one of these. */
  id: string;
  label: string;
  division: Division;
};

export const DIVISION_LABEL: Record<Division, string> = {
  barishal: "Barishal",
  chattogram: "Chattogram",
  dhaka: "Dhaka",
  khulna: "Khulna",
  mymensingh: "Mymensingh",
  rajshahi: "Rajshahi",
  rangpur: "Rangpur",
  sylhet: "Sylhet",
};

/** Held in division order; `DISTRICTS` below is the alphabetical view. */
const BY_DIVISION: Record<Division, string[]> = {
  barishal: [
    "Barguna",
    "Barishal",
    "Bhola",
    "Jhalokati",
    "Patuakhali",
    "Pirojpur",
  ],
  chattogram: [
    "Bandarban",
    "Brahmanbaria",
    "Chandpur",
    "Chattogram",
    "Cumilla",
    "Cox's Bazar",
    "Feni",
    "Khagrachhari",
    "Lakshmipur",
    "Noakhali",
    "Rangamati",
  ],
  dhaka: [
    "Dhaka",
    "Faridpur",
    "Gazipur",
    "Gopalganj",
    "Kishoreganj",
    "Madaripur",
    "Manikganj",
    "Munshiganj",
    "Narayanganj",
    "Narsingdi",
    "Rajbari",
    "Shariatpur",
    "Tangail",
  ],
  khulna: [
    "Bagerhat",
    "Chuadanga",
    "Jashore",
    "Jhenaidah",
    "Khulna",
    "Kushtia",
    "Magura",
    "Meherpur",
    "Narail",
    "Satkhira",
  ],
  mymensingh: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
  rajshahi: [
    "Bogura",
    "Chapainawabganj",
    "Joypurhat",
    "Naogaon",
    "Natore",
    "Pabna",
    "Rajshahi",
    "Sirajganj",
  ],
  rangpur: [
    "Dinajpur",
    "Gaibandha",
    "Kurigram",
    "Lalmonirhat",
    "Nilphamari",
    "Panchagarh",
    "Rangpur",
    "Thakurgaon",
  ],
  sylhet: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
};

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Alphabetical — the order the dropdown shows, and how a person looks one up. */
export const DISTRICTS: District[] = (
  Object.entries(BY_DIVISION) as [Division, string[]][]
)
  .flatMap(([division, labels]) =>
    labels.map((label) => ({ id: slug(label), label, division })),
  )
  .sort((a, b) => a.label.localeCompare(b.label));

const BY_ID = new Map(DISTRICTS.map((d) => [d.id, d]));

export function isDistrictId(value: string): boolean {
  return BY_ID.has(value);
}

export function districtLabel(id?: string | null): string | null {
  if (!id) return null;
  return BY_ID.get(id)?.label ?? null;
}

export function districtDivision(id?: string | null): Division | null {
  if (!id) return null;
  return BY_ID.get(id)?.division ?? null;
}

/** Dropdown options: label alone, since two districts never share a name. */
export const DISTRICT_OPTIONS = DISTRICTS.map((d) => ({
  value: d.id,
  label: d.label,
}));
