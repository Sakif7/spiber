import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { TravelRequest, type ITravelRequest } from "@/lib/models/travelRequest";
import type { Lean } from "@/lib/models/_shared";
import type {
  TravelRequestStatus,
  TravelRequestType,
} from "@/lib/schemas/travel-request";

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

export type TravelRequestListParams = {
  status?: TravelRequestStatus;
  type?: TravelRequestType;
  assignedTo?: string;
  page?: number;
  pageSize?: number;
};

export async function listTravelRequests(params: TravelRequestListParams = {}) {
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
    TravelRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<ITravelRequest>[]>()
      .exec(),
    TravelRequest.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
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
