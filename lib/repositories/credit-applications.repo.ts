import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  CreditApplication,
  type ICreditApplication,
} from "@/lib/models/credit-application";
import type { Lean } from "@/lib/models/_shared";
import type { CreditApplicationStatus } from "@/lib/schemas/credit";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type Filter = NonNullable<
  Parameters<typeof CreditApplication.countDocuments>[0]
>;

export async function createCreditApplication(
  data: Partial<ICreditApplication>,
) {
  await connectToDatabase();
  return CreditApplication.create(data);
}

export async function getCreditApplicationById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return CreditApplication.findById(id).exec();
}

export async function getCreditApplicationByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return CreditApplication.findById(id).lean<Lean<ICreditApplication>>().exec();
}

/** The user's most recent open (new/reviewing) application, if any. */
export async function getOpenCreditApplicationByUser(userId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(userId)) return null;
  return CreditApplication.findOne({
    userId,
    status: { $in: ["new", "reviewing"] },
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean<Lean<ICreditApplication>>()
    .exec();
}

/** Latest application of ANY status — drives the "you already applied" panel. */
export async function getLatestCreditApplicationByUser(userId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(userId)) return null;
  return CreditApplication.findOne({ userId, deletedAt: null })
    .sort({ createdAt: -1 })
    .lean<Lean<ICreditApplication>>()
    .exec();
}

export async function listCreditApplications(
  params: { status?: CreditApplicationStatus; assignedTo?: string } = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.assignedTo) q.assignedTo = params.assignedTo;
  return CreditApplication.find(q as unknown as Filter)
    .sort({ createdAt: -1 })
    .lean<Lean<ICreditApplication>[]>()
    .exec();
}

/** Sort keys the admin list exposes → stored fields. */
const CREDIT_APPLICATION_SORT: Record<string, string> = {
  date: "createdAt",
  number: "applicationNumber",
  organization: "organization",
  status: "status",
};

export type CreditApplicationAdminListParams = RepoListQuery & {
  status?: CreditApplicationStatus;
};

/** Searchable, sortable, paged list for the admin (list kit). */
export async function listCreditApplicationsForAdmin(
  params: CreditApplicationAdminListParams = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  applyPartialSearch(q, params.search, [
    "applicationNumber",
    "organization",
    "contactName",
    "email",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<ICreditApplication>(CreditApplication, q, {
    sort: sortSpec(params.sort, params.dir, CREDIT_APPLICATION_SORT),
    page: params.page,
    pageSize: params.pageSize,
  });
}

export async function countOpenCreditApplications(): Promise<number> {
  await connectToDatabase();
  return CreditApplication.countDocuments({
    status: { $in: ["new", "reviewing"] },
    deletedAt: null,
  } as unknown as Filter);
}

export async function addCreditApplicationNote(
  id: string,
  authorId: string,
  body: string,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return CreditApplication.findByIdAndUpdate(
    id,
    { $push: { activity: { authorId, body, at: new Date() } } },
    { returnDocument: "after" },
  )
    .lean<Lean<ICreditApplication>>()
    .exec();
}

export async function setCreditApplicationAssignee(
  id: string,
  assignedTo: string | null,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return CreditApplication.findByIdAndUpdate(
    id,
    { $set: { assignedTo } },
    { returnDocument: "after" },
  )
    .lean<Lean<ICreditApplication>>()
    .exec();
}

export type { ICreditApplication };
