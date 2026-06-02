import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Inquiry, type IInquiry } from "@/lib/models/inquiry";
import type { Lean } from "@/lib/models/_shared";
import type { InquiryDivision, InquiryStatus } from "@/lib/schemas/inquiry";

type InquiryFilter = NonNullable<Parameters<typeof Inquiry.countDocuments>[0]>;

export async function createInquiry(data: Partial<IInquiry>) {
  await connectToDatabase();
  return Inquiry.create(data);
}

export async function getInquiryById(id: string) {
  await connectToDatabase();
  return Inquiry.findById(id).exec();
}

export async function getInquiryByIdLean(id: string) {
  await connectToDatabase();
  return Inquiry.findById(id).lean<Lean<IInquiry>>().exec();
}

export type InquiryListParams = {
  division?: InquiryDivision;
  status?: InquiryStatus;
  assignedTo?: string;
  page?: number;
  pageSize?: number;
};

export async function listInquiries(params: InquiryListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.division) q.division = params.division;
  if (params.status) q.status = params.status;
  if (params.assignedTo) q.assignedTo = params.assignedTo;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const filter = q as unknown as InquiryFilter;
  const [items, total] = await Promise.all([
    Inquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IInquiry>[]>()
      .exec(),
    Inquiry.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
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
