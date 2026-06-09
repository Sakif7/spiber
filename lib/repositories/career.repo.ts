import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { JobPosting, type IJobPosting } from "@/lib/models/jobPosting";
import {
  JobApplication,
  type IJobApplication,
} from "@/lib/models/jobApplication";
import type { Lean } from "@/lib/models/_shared";
import type { ApplicationStatus, JobStatus } from "@/lib/schemas/career";
import { applyPartialSearch } from "@/lib/repositories/search-filter";

type JobFilter = NonNullable<Parameters<typeof JobPosting.countDocuments>[0]>;
type AppFilter = NonNullable<
  Parameters<typeof JobApplication.countDocuments>[0]
>;

// ───────────────────────── Jobs (public) ─────────────────────────
export type PublicJobListParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listOpenJobs(params: PublicJobListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null, status: "open" };
  applyPartialSearch(q, params.search, [
    "title.en",
    "title.bn",
    "department.en",
    "department.bn",
    "location.en",
    "location.bn",
    "summary.en",
    "summary.bn",
  ]);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? 24));
  const filter = q as unknown as JobFilter;
  const [items, total] = await Promise.all([
    JobPosting.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IJobPosting>[]>()
      .exec(),
    JobPosting.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getOpenJobBySlug(slug: string) {
  await connectToDatabase();
  return JobPosting.findOne({ slug, deletedAt: null, status: "open" })
    .lean<Lean<IJobPosting>>()
    .exec();
}

/** Other open jobs (excludes the given id) for the "Related opportunities" rail. */
export async function listRelatedJobs(excludeId: string, limit = 3) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null, status: "open" };
  if (mongoose.isValidObjectId(excludeId)) q._id = { $ne: excludeId };
  return JobPosting.find(q as unknown as JobFilter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Lean<IJobPosting>[]>()
    .exec();
}

/** Visible jobs for the sitemap. */
export async function listVisibleJobsForFeed(limit = 100) {
  await connectToDatabase();
  return JobPosting.find({
    deletedAt: null,
    status: "open",
  } as unknown as JobFilter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Lean<IJobPosting>[]>()
    .exec();
}

// ───────────────────────── Jobs (admin) ─────────────────────────
export async function listAdminJobs(
  params: { status?: JobStatus; page?: number; pageSize?: number } = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const filter = q as unknown as JobFilter;
  const [items, total] = await Promise.all([
    JobPosting.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IJobPosting>[]>()
      .exec(),
    JobPosting.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getJobByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return JobPosting.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IJobPosting>>()
    .exec();
}

export async function createJob(data: Partial<IJobPosting>) {
  await connectToDatabase();
  return JobPosting.create(data);
}

export async function updateJob(id: string, data: Partial<IJobPosting>) {
  await connectToDatabase();
  return JobPosting.findOneAndUpdate({ _id: id, deletedAt: null }, data, {
    new: true,
  }).exec();
}

export async function softDeleteJob(id: string) {
  await connectToDatabase();
  await JobPosting.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date(), status: "closed" } },
  ).exec();
}

// ───────────────────────── Applications ─────────────────────────
export async function createApplication(data: Partial<IJobApplication>) {
  await connectToDatabase();
  return JobApplication.create(data);
}

export async function listApplications(
  params: {
    jobId?: string;
    status?: ApplicationStatus;
    page?: number;
    pageSize?: number;
  } = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.jobId && mongoose.isValidObjectId(params.jobId))
    q.jobId = params.jobId;
  if (params.status) q.status = params.status;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const filter = q as unknown as AppFilter;
  const [items, total] = await Promise.all([
    JobApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IJobApplication>[]>()
      .exec(),
    JobApplication.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getApplicationByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return JobApplication.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IJobApplication>>()
    .exec();
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
) {
  await connectToDatabase();
  return JobApplication.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: { status } },
    { new: true },
  ).exec();
}

export async function softDeleteApplication(id: string) {
  await connectToDatabase();
  await JobApplication.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date() } },
  ).exec();
}

export async function countNewApplications() {
  await connectToDatabase();
  return JobApplication.countDocuments({ deletedAt: null, status: "new" });
}
