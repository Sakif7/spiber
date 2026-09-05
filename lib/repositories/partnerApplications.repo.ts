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
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

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

/** Sort keys the admin list exposes → stored fields. */
const PARTNER_SORT: Record<string, string> = {
  date: "createdAt",
  number: "partnerApplicationNumber",
  organization: "orgInfo.name",
  status: "status",
  type: "type",
};

export type PartnerApplicationListParams = RepoListQuery & {
  status?: PartnerApplicationStatus;
  type?: PartnerType;
  assignedTo?: string;
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
  applyPartialSearch(q, params.search, [
    "partnerApplicationNumber",
    "orgInfo.name",
    "contact.name",
    "contact.email",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<IPartnerApplication>(PartnerApplication, q, {
    sort: sortSpec(params.sort, params.dir, PARTNER_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
    maxPageSize: 200,
  });
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
