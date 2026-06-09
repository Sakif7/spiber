import { z } from "zod";
import { localizedSchema } from "./localized";

/**
 * Career model. Two entities: admin-managed Job postings, and public Job
 * applications (name/email/phone + cover letter + an uploaded résumé referenced
 * by a private storage key). Zod is the single source of truth. Jobs are
 * visible publicly when status = open.
 */

export const jobStatusEnum = z.enum(["draft", "open", "closed"]);
export type JobStatus = z.infer<typeof jobStatusEnum>;

export const employmentTypeEnum = z.enum([
  "full_time",
  "part_time",
  "contract",
  "internship",
  "temporary",
]);
export type EmploymentType = z.infer<typeof employmentTypeEnum>;

// `slug` optional on input; the route derives it from `title.en` when blank.
export const jobSchema = z.object({
  title: localizedSchema,
  slug: z.string().max(160).optional(),
  department: localizedSchema.optional(),
  reportsTo: localizedSchema.optional(),
  location: localizedSchema.optional(),
  employmentType: employmentTypeEnum.default("full_time"),
  experience: localizedSchema.optional(),
  vacancies: z.coerce.number().int().min(0).max(9999).optional(),
  summary: localizedSchema.optional(),
  description: localizedSchema,
  responsibilities: localizedSchema.optional(),
  requirements: localizedSchema.optional(),
  preferredSkills: localizedSchema.optional(),
  /** Benefits / perks, one per line — rendered as the "What We Offer" grid. */
  benefits: localizedSchema.optional(),
  applyEmail: z.string().email().max(160).optional().or(z.literal("")),
  recruiterName: z.string().max(120).optional().or(z.literal("")),
  recruiterTitle: localizedSchema.optional(),
  recruiterEmail: z.string().email().max(160).optional().or(z.literal("")),
  recruiterPhone: z.string().max(40).optional().or(z.literal("")),
  closesAt: z.coerce.date().optional(),
  status: jobStatusEnum.default("draft"),
});
export type JobInput = z.infer<typeof jobSchema>;

export const applicationStatusEnum = z.enum([
  "new",
  "reviewing",
  "shortlisted",
  "interviewing",
  "rejected",
  "hired",
]);
export type ApplicationStatus = z.infer<typeof applicationStatusEnum>;

// Public application submit. `resumeKey` is the private storage key returned by
// the résumé upload endpoint; `website` is a honeypot (must be empty).
export const jobApplicationCreateSchema = z.object({
  jobId: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  phone: z.string().min(3).max(40),
  coverLetter: z.string().max(5000).optional(),
  resumeKey: z.string().min(1).max(300),
  resumeName: z.string().max(200).optional(),
  locale: z.string().max(5).optional(),
  website: z.string().optional(),
});
export type JobApplicationCreateInput = z.infer<
  typeof jobApplicationCreateSchema
>;

export const applicationStatusUpdateSchema = z.object({
  status: applicationStatusEnum,
});
