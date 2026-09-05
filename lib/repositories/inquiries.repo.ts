import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Inquiry, type IInquiry } from "@/lib/models/inquiry";
import type { Lean } from "@/lib/models/_shared";
import type { InquiryDivision, InquiryStatus } from "@/lib/schemas/inquiry";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type InquiryFilter = NonNullable<Parameters<typeof Inquiry.countDocuments>[0]>;

export async function createInquiry(data: Partial<IInquiry>) {
  await connectToDatabase();
  return Inquiry.create(data);
}

export async function getInquiryById(id: string) {
  await connectToDatabase();
  // A malformed id would otherwise throw a CastError (→ unhandled 500); treat it
  // as "not found" so callers return a clean 404.
  if (!mongoose.isValidObjectId(id)) return null;
  return Inquiry.findById(id).exec();
}

export async function getInquiryByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Inquiry.findById(id).lean<Lean<IInquiry>>().exec();
}

/** Sort keys the admin inquiries list exposes → stored fields. */
const INQUIRY_SORT: Record<string, string> = {
  date: "createdAt",
  number: "inquiryNumber",
  name: "name",
  status: "status",
  division: "division",
};

export type InquiryListParams = RepoListQuery & {
  division?: InquiryDivision;
  status?: InquiryStatus;
  assignedTo?: string;
};

export async function listInquiries(params: InquiryListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.division) q.division = params.division;
  if (params.status) q.status = params.status;
  if (params.assignedTo && mongoose.isValidObjectId(params.assignedTo)) {
    q.assignedTo = params.assignedTo;
  }
  applyPartialSearch(q, params.search, [
    "inquiryNumber",
    "name",
    "email",
    "organization",
    "subject",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<IInquiry>(Inquiry, q, {
    sort: sortSpec(params.sort, params.dir, INQUIRY_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
  });
}

/** Open (non-won/lost) inquiry count for the dashboard KPI. */
export async function countOpenInquiries(
  division?: InquiryDivision,
): Promise<number> {
  await connectToDatabase();
  const q: Record<string, unknown> = {
    status: { $in: ["new", "qualifying", "proposal"] },
  };
  if (division) q.division = division;
  return Inquiry.countDocuments(q as unknown as InquiryFilter);
}

export async function addInquiryNote(
  id: string,
  authorId: string,
  body: string,
) {
  await connectToDatabase();
  return Inquiry.findByIdAndUpdate(
    id,
    {
      $push: {
        notes: {
          authorId: new mongoose.Types.ObjectId(authorId),
          body,
          at: new Date(),
        },
      },
    },
    { new: true },
  ).exec();
}

export async function setInquiryAssignee(
  id: string,
  assignedTo: string | null,
) {
  await connectToDatabase();
  return Inquiry.findByIdAndUpdate(
    id,
    { assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null },
    { new: true },
  ).exec();
}
