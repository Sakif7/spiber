import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { TravelRequest, type ITravelRequest } from "@/lib/models/travelRequest";
import type { Lean } from "@/lib/models/_shared";
import type {
  TravelRequestStatus,
  TravelRequestType,
} from "@/lib/schemas/travel-request";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type Filter = NonNullable<Parameters<typeof TravelRequest.countDocuments>[0]>;

export async function createTravelRequest(data: Partial<ITravelRequest>) {
  await connectToDatabase();
  return TravelRequest.create(data);
}

export async function getTravelRequestById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return TravelRequest.findOne({ _id: id, deletedAt: null }).exec();
}

export async function getTravelRequestByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return TravelRequest.findOne({ _id: id, deletedAt: null })
    .lean<Lean<ITravelRequest>>()
    .exec();
}

export async function getTravelRequestByNumber(
  travelRequestNumber: string,
  email: string,
) {
  await connectToDatabase();
  return TravelRequest.findOne({
    travelRequestNumber,
    "contact.email": email.trim().toLowerCase(),
    deletedAt: null,
  })
    .lean<Lean<ITravelRequest>>()
    .exec();
}

/** Sort keys the admin list exposes → stored fields. */
const TRAVEL_SORT: Record<string, string> = {
  date: "createdAt",
  number: "travelRequestNumber",
  contact: "contact.name",
  status: "status",
  type: "type",
  quoted: "quote.amountMinor",
};

export type TravelRequestListParams = RepoListQuery & {
  status?: TravelRequestStatus;
  type?: TravelRequestType;
  assignedTo?: string;
};

export async function listTravelRequests(params: TravelRequestListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.type) q.type = params.type;
  if (params.assignedTo && mongoose.isValidObjectId(params.assignedTo)) {
    q.assignedTo = params.assignedTo;
  }
  applyPartialSearch(q, params.search, [
    "travelRequestNumber",
    "contact.name",
    "contact.email",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<ITravelRequest>(TravelRequest, q, {
    sort: sortSpec(params.sort, params.dir, TRAVEL_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
    maxPageSize: 200,
  });
}

export async function countOpenTravelRequests(): Promise<number> {
  await connectToDatabase();
  return TravelRequest.countDocuments({
    deletedAt: null,
    status: { $in: ["new", "quoted"] },
  } as unknown as Filter);
}

export async function addTravelRequestNote(
  id: string,
  authorId: string,
  body: string,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return TravelRequest.findByIdAndUpdate(
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

export async function setTravelRequestAssignee(
  id: string,
  assignedTo: string | null,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return TravelRequest.findByIdAndUpdate(
    id,
    { assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null },
    { new: true },
  ).exec();
}
