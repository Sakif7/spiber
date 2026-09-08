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
import {
  applyDateRange,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type JobFilter = NonNullable<Parameters<typeof JobPosting.countDocuments>[0]>;

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
/** Sort keys the admin list exposes → stored fields. */
const ADMIN_JOB_SORT: Record<string, string> = {
  date: "createdAt",
  title: "title.en",
  status: "status",
  type: "employmentType",
  department: "department.en",
};

export type AdminJobListParams = RepoListQuery & {
  status?: JobStatus;
  employmentType?: string;
};

export async function listAdminJobs(params: AdminJobListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.employmentType) q.employmentType = params.employmentType;
  applyPartialSearch(q, params.search, [
    "title.en",
    "title.bn",
    "department.en",
    "location.en",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<IJobPosting>(JobPosting, q, {
    sort: sortSpec(params.sort, params.dir, ADMIN_JOB_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
  });
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

/** Returns false when no such live record exists, so the route can 404. */
export async function softDeleteJob(id: string): Promise<boolean> {
  await connectToDatabase();
  const res = await JobPosting.updateOne(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date(), status: "closed" } },
  ).exec();
  return res.matchedCount > 0;
}

// ───────────────────────── Applications ─────────────────────────
export async function createApplication(data: Partial<IJobApplication>) {
  await connectToDatabase();
  return JobApplication.create(data);
}

/** Sort keys the admin applications list exposes → stored fields. */
const APPLICATION_SORT: Record<string, string> = {
  date: "createdAt",
  name: "name",
  status: "status",
  role: "jobTitle",
};

export type ApplicationListParams = RepoListQuery & {
  jobId?: string;
  status?: ApplicationStatus;
};

export async function listApplications(params: ApplicationListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.jobId && mongoose.isValidObjectId(params.jobId))
    q.jobId = params.jobId;
  if (params.status) q.status = params.status;
  applyPartialSearch(q, params.search, ["name", "email", "jobTitle"]);
  applyDateRange(q, params.from, params.to);
  return paginate<IJobApplication>(JobApplication, q, {
    sort: sortSpec(params.sort, params.dir, APPLICATION_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
  });
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

/** Returns false when no such live record exists, so the route can 404. */
export async function softDeleteApplication(id: string): Promise<boolean> {
  await connectToDatabase();
  const res = await JobApplication.updateOne(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  ).exec();
  return res.matchedCount > 0;
}

export async function countNewApplications() {
  await connectToDatabase();
  return JobApplication.countDocuments({ deletedAt: null, status: "new" });
}
