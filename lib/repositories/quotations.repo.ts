import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Quotation, type IQuotation } from "@/lib/models/quotation";
import type { Lean } from "@/lib/models/_shared";
import type { QuotationStatus } from "@/lib/schemas/quotation";

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

export type QuotationListParams = {
  status?: QuotationStatus;
  assignedTo?: string;
  page?: number;
  pageSize?: number;
};

export async function listQuotations(params: QuotationListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.assignedTo) q.assignedTo = params.assignedTo;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));
  const filter = q as unknown as QuotationFilter;
  const [items, total] = await Promise.all([
    Quotation.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IQuotation>[]>()
      .exec(),
    Quotation.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
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
