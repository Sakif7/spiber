import mongoose, { Schema, type Model } from "mongoose";
import type { ApplicationStatus } from "@/lib/schemas/career";

/**
 * A public application to a Job posting. The résumé is stored as a PRIVATE
 * storage key (never a public URL) and only downloadable by admins through the
 * gated /api/admin/career/applications/[id]/resume route. `jobTitle` is a
 * snapshot so the admin inbox lists the role without a join.
 */
export interface IJobApplication {
  applicationNumber: string;
  jobId: mongoose.Types.ObjectId | string;
  jobTitle?: string;
  name: string;
  email: string;
  phone: string;
  coverLetter?: string;
  resumeKey: string;
  resumeName?: string;
  status: ApplicationStatus;
  locale?: string;
  meta?: { ip?: string; userAgent?: string };
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const jobApplicationSchema = new Schema<IJobApplication>(
  {
    applicationNumber: { type: String, required: true, unique: true },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "JobPosting",
      required: true,
      index: true,
    },
    jobTitle: { type: String },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    coverLetter: { type: String },
    resumeKey: { type: String, required: true },
    resumeName: { type: String },
    status: {
      type: String,
      enum: [
        "new",
        "reviewing",
        "shortlisted",
        "interviewing",
        "rejected",
        "hired",
      ],
      default: "new",
      index: true,
    },
    locale: { type: String },
    meta: {
      type: new Schema({ ip: String, userAgent: String }, { _id: false }),
      default: undefined,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "job_applications", timestamps: true },
);

jobApplicationSchema.index({ jobId: 1, createdAt: -1 });
jobApplicationSchema.index({ status: 1, createdAt: -1 });

export const JobApplication: Model<IJobApplication> =
  (mongoose.models.JobApplication as Model<IJobApplication>) ??
  mongoose.model<IJobApplication>("JobApplication", jobApplicationSchema);
