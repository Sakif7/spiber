import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Quotation, type IQuotation } from "@/lib/models/quotation";
import type { Lean } from "@/lib/models/_shared";
import type { QuotationStatus } from "@/lib/schemas/quotation";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type QuotationFilter = NonNullable<
  Parameters<typeof Quotation.countDocuments>[0]
>;

export async function createQuotation(data: Partial<IQuotation>) {
  await connectToDatabase();
  return Quotation.create(data);
}

export async function getQuotationById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Quotation.findOne({ _id: id, deletedAt: null }).exec();
}

export async function getQuotationByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Quotation.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IQuotation>>()
    .exec();
}

export async function getQuotationByNumber(quotationNumber: string) {
  await connectToDatabase();
  return Quotation.findOne({ quotationNumber, deletedAt: null })
    .lean<Lean<IQuotation>>()
    .exec();
}

/** Sort keys the admin quotations list exposes → stored fields. */
const QUOTATION_SORT: Record<string, string> = {
  date: "createdAt",
  number: "quotationNumber",
  requester: "contact.name",
  status: "status",
  quoted: "quote.amountMinor",
};

export type QuotationListParams = RepoListQuery & {
  status?: QuotationStatus;
  assignedTo?: string;
};

export async function listQuotations(params: QuotationListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.assignedTo) q.assignedTo = params.assignedTo;
  applyPartialSearch(q, params.search, [
    "quotationNumber",
    "contact.name",
    "contact.email",
    "contact.organization",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<IQuotation>(Quotation, q, {
    sort: sortSpec(params.sort, params.dir, QUOTATION_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
    maxPageSize: 200,
  });
}

export async function listQuotationsByRequester(userId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(userId)) return [];
  return Quotation.find({ requesterId: userId, deletedAt: null })
    .sort({ createdAt: -1 })
    .lean<Lean<IQuotation>[]>()
    .exec();
}

/** Open (non-won/lost) quotation count for the dashboard KPI. */
export async function countOpenQuotations(): Promise<number> {
  await connectToDatabase();
  return Quotation.countDocuments({
    deletedAt: null,
    status: { $in: ["new", "quoted", "negotiating"] },
  } as unknown as QuotationFilter);
}

export async function addQuotationNote(
  id: string,
  authorId: string,
  body: string,
) {
  await connectToDatabase();
  return Quotation.findByIdAndUpdate(
    id,
    {
      $push: {
        activity: {
          authorId: new mongoose.Types.ObjectId(authorId),
          body,
          at: new Date(),
        },
      },
    },
    { new: true },
  ).exec();
}

export async function setQuotationAssignee(
  id: string,
  assignedTo: string | null,
) {
  await connectToDatabase();
  return Quotation.findByIdAndUpdate(
    id,
    { assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null },
    { new: true },
  ).exec();
}
