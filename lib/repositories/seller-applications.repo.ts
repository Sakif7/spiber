import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  SellerApplication,
  type ISellerApplication,
} from "@/lib/models/seller-application";
import type { Lean } from "@/lib/models/_shared";
import type { SellerApplicationStatus } from "@/lib/schemas/seller-application";

type Filter = NonNullable<
  Parameters<typeof SellerApplication.countDocuments>[0]
>;

export async function createSellerApplication(
  data: Partial<ISellerApplication>,
) {
  await connectToDatabase();
  return SellerApplication.create(data);
}

export async function getSellerApplicationById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return SellerApplication.findById(id).exec();
}

export async function getSellerApplicationByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return SellerApplication.findById(id).lean<Lean<ISellerApplication>>().exec();
}

/** The user's most recent open (new/reviewing) application, if any. */
export async function getOpenApplicationByUser(userId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(userId)) return null;
  return SellerApplication.findOne({
    userId,
    status: { $in: ["new", "reviewing"] },
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean<Lean<ISellerApplication>>()
    .exec();
}

export async function listSellerApplications(
  params: { status?: SellerApplicationStatus; assignedTo?: string } = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.assignedTo) q.assignedTo = params.assignedTo;
  return SellerApplication.find(q as unknown as Filter)
    .sort({ createdAt: -1 })
    .lean<Lean<ISellerApplication>[]>()
    .exec();
}

export async function countOpenSellerApplications(): Promise<number> {
  await connectToDatabase();
  return SellerApplication.countDocuments({
    status: { $in: ["new", "reviewing"] },
    deletedAt: null,
  } as unknown as Filter);
}

export async function addSellerApplicationNote(
  id: string,
  authorId: string,
  body: string,
) {
  await connectToDatabase();
  return SellerApplication.findByIdAndUpdate(
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

export async function setSellerApplicationAssignee(
  id: string,
  assignedTo: string | null,
) {
  await connectToDatabase();
  return SellerApplication.findByIdAndUpdate(
    id,
    { assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null },
    { new: true },
  ).exec();
}
