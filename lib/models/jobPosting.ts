import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { EmploymentType, JobStatus } from "@/lib/schemas/career";

const optionalLocalized = { en: { type: String }, bn: { type: String } };

export interface IJobPosting {
  title: LocalizedDoc;
  slug: string;
  department?: LocalizedDoc;
  reportsTo?: LocalizedDoc;
  location?: LocalizedDoc;
  employmentType: EmploymentType;
  experience?: LocalizedDoc;
  vacancies?: number | null;
  summary?: LocalizedDoc;
  description: LocalizedDoc;
  responsibilities?: LocalizedDoc;
  requirements?: LocalizedDoc;
  preferredSkills?: LocalizedDoc;
  benefits?: LocalizedDoc;
  applyEmail?: string;
  recruiterName?: string;
  recruiterTitle?: LocalizedDoc;
  recruiterEmail?: string;
  recruiterPhone?: string;
  closesAt?: Date | null;
  status: JobStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const jobPostingSchema = new Schema<IJobPosting>(
  {
    title: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    department: optionalLocalized,
    reportsTo: optionalLocalized,
    location: optionalLocalized,
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "contract", "internship", "temporary"],
      default: "full_time",
    },
    experience: optionalLocalized,
    vacancies: { type: Number, default: null },
    summary: optionalLocalized,
    description: { ...localizedDef },
    responsibilities: optionalLocalized,
    requirements: optionalLocalized,
    preferredSkills: optionalLocalized,
    benefits: optionalLocalized,
    applyEmail: { type: String },
    recruiterName: { type: String },
    recruiterTitle: optionalLocalized,
    recruiterEmail: { type: String },
    recruiterPhone: { type: String },
    closesAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["draft", "open", "closed"],
      default: "draft",
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "job_postings", timestamps: true },
);

// Unique slug among non-deleted jobs (soft-deleted rows free their slug).
jobPostingSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
jobPostingSchema.index({ status: 1, createdAt: -1 });

export const JobPosting: Model<IJobPosting> =
  (mongoose.models.JobPosting as Model<IJobPosting>) ??
  mongoose.model<IJobPosting>("JobPosting", jobPostingSchema);
