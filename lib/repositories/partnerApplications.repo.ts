import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  PartnerApplication,
  type IPartnerApplication,
  type IPartnerDocument,
} from "@/lib/models/partnerApplication";
import type { Lean } from "@/lib/models/_shared";
import type {
  PartnerApplicationStatus,
  PartnerType,
} from "@/lib/schemas/partner-application";

type Filter = NonNullable<
  Parameters<typeof PartnerApplication.countDocuments>[0]
>;

export async function createPartnerApplication(
  data: Partial<IPartnerApplication>,
) {
  await connectToDatabase();
  return PartnerApplication.create(data);
}

export async function getPartnerApplicationById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return PartnerApplication.findOne({ _id: id, deletedAt: null }).exec();
}

export async function getPartnerApplicationByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return PartnerApplication.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IPartnerApplication>>()
    .exec();
}

export type PartnerApplicationListParams = {
  status?: PartnerApplicationStatus;
  type?: PartnerType;
  assignedTo?: string;
  page?: number;
  pageSize?: number;
};

export async function listPartnerApplications(
  params: PartnerApplicationListParams = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.type) q.type = params.type;
  if (params.assignedTo && mongoose.isValidObjectId(params.assignedTo)) {
    q.assignedTo = params.assignedTo;
  }
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));
  const filter = q as unknown as Filter;
  const [items, total] = await Promise.all([
    PartnerApplication.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IPartnerApplication>[]>()
      .exec(),
    PartnerApplication.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function countOpenPartnerApplications(): Promise<number> {
  await connectToDatabase();
  return PartnerApplication.countDocuments({
    deletedAt: null,
    status: { $in: ["new", "reviewing"] },
  } as unknown as Filter);
}

export async function addPartnerApplicationNote(
  id: string,
  authorId: string,
  body: string,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return PartnerApplication.findByIdAndUpdate(
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

export async function setPartnerApplicationAssignee(
  id: string,
  assignedTo: string | null,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return PartnerApplication.findByIdAndUpdate(
    id,
    { assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null },
    { new: true },
  ).exec();
}

export async function pushPartnerApplicationDocument(
  id: string,
  doc: IPartnerDocument,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return PartnerApplication.findByIdAndUpdate(
    id,
    { $push: { documents: doc } },
    { new: true },
  ).exec();
}
