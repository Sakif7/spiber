import { z } from "zod";
import { localizedSchema } from "./localized";

/**
 * Spiber Tourism catalog content (admin-managed, browseable). Destinations,
 * Hospitals, Doctors and TreatmentPackages are bilingual `{en,bn}` content with
 * a draft/active status + soft-delete, mirroring the Product catalog conventions
 * (localizedDef, partial-unique slug, text index). Browsing/filtering these IS
 * the "real search" the brief distinguishes from the manual request forms.
 */

export const tourismStatusEnum = z.enum(["draft", "active"]);
export type TourismStatus = z.infer<typeof tourismStatusEnum>;

/** Surgery + health-check package categories (per the brief). */
export const treatmentCategoryEnum = z.enum([
  "cardiac",
  "ortho",
  "neuro",
  "oncology",
  "ivf",
  "cosmetic",
  "health-check",
]);
export type TreatmentCategory = z.infer<typeof treatmentCategoryEnum>;

/**
 * Estimated cost range shown to patients: a BDT range (integer poisha) plus an
 * optional, clearly-LABELED foreign-currency estimate (the brief requires costs
 * in BDT with labeled foreign ranges — never混 mixed into one figure).
 */
export const costRangeSchema = z.object({
  bdtMinMinor: z.number().int().nonnegative().nullable().optional(),
  bdtMaxMinor: z.number().int().nonnegative().nullable().optional(),
  /** e.g. "USD 4,000–6,000 (excl. airfare)" — display as-is, clearly labeled. */
  foreignLabel: z.string().max(160).optional(),
  foreignNote: localizedSchema.optional(),
});
export type CostRangeInput = z.infer<typeof costRangeSchema>;

const slug = z
  .string()
  .min(1)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase slug");

// ---------------------------------------------------------------- Destination
export const destinationCreateSchema = z.object({
  name: localizedSchema,
  slug,
  heroImage: z.string().max(512).optional(),
  overview: localizedSchema.optional(),
  popularTreatments: z.array(localizedSchema).max(40).optional(),
  costRange: costRangeSchema.optional(),
  partnerHospitalIds: z.array(z.string().min(1)).max(100).optional(),
  featured: z.boolean().optional(),
  status: tourismStatusEnum.default("draft"),
});
export type DestinationCreateInput = z.infer<typeof destinationCreateSchema>;
export const destinationUpdateSchema = destinationCreateSchema.partial();
export type DestinationUpdateInput = z.infer<typeof destinationUpdateSchema>;

// ------------------------------------------------------------------- Hospital
export const hospitalCreateSchema = z.object({
  name: localizedSchema,
  slug,
  country: localizedSchema,
  city: localizedSchema.optional(),
  accreditations: z.array(z.string().max(80)).max(40).optional(),
  specialties: z.array(localizedSchema).max(60).optional(),
  profile: localizedSchema.optional(),
  images: z.array(z.string().max(512)).max(20).optional(),
  destinationId: z.string().min(1).nullable().optional(),
  status: tourismStatusEnum.default("draft"),
});
export type HospitalCreateInput = z.infer<typeof hospitalCreateSchema>;
export const hospitalUpdateSchema = hospitalCreateSchema.partial();
export type HospitalUpdateInput = z.infer<typeof hospitalUpdateSchema>;

// --------------------------------------------------------------------- Doctor
export const doctorCreateSchema = z.object({
  name: z.string().min(1).max(160),
  slug,
  specialty: localizedSchema,
  hospitalId: z.string().min(1).nullable().optional(),
  location: localizedSchema.optional(),
  bio: localizedSchema.optional(),
  photo: z.string().max(512).optional(),
  onlineConsultation: z.boolean().optional(),
  status: tourismStatusEnum.default("draft"),
});
export type DoctorCreateInput = z.infer<typeof doctorCreateSchema>;
export const doctorUpdateSchema = doctorCreateSchema.partial();
export type DoctorUpdateInput = z.infer<typeof doctorUpdateSchema>;

// ----------------------------------------------------------- TreatmentPackage
export const packageCreateSchema = z.object({
  name: localizedSchema,
  slug,
  category: treatmentCategoryEnum,
  description: localizedSchema.optional(),
  hospitalOptionIds: z.array(z.string().min(1)).max(100).optional(),
  costRange: costRangeSchema.optional(),
  inclusions: z.array(localizedSchema).max(60).optional(),
  status: tourismStatusEnum.default("draft"),
});
export type PackageCreateInput = z.infer<typeof packageCreateSchema>;
export const packageUpdateSchema = packageCreateSchema.partial();
export type PackageUpdateInput = z.infer<typeof packageUpdateSchema>;
