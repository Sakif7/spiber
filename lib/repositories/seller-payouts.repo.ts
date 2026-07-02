import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { SellerPayout, type ISellerPayout } from "@/lib/models/seller-payout";
import type { Lean } from "@/lib/models/_shared";
import type { SellerPayoutStatus } from "@/lib/schemas/seller-commission";

export async function createSellerPayout(data: Partial<ISellerPayout>) {
  await connectToDatabase();
  return SellerPayout.create(data);
}

export async function getSellerPayoutById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return SellerPayout.findOne({ _id: id, deletedAt: null }).exec();
}

export async function listSellerPayouts(
  params: { sellerId?: string; status?: SellerPayoutStatus } = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.sellerId) q.sellerId = params.sellerId;
  if (params.status) q.status = params.status;
  return SellerPayout.find(q)
    .sort({ createdAt: -1 })
    .lean<Lean<ISellerPayout>[]>()
    .exec();
}

export async function setPayoutStatus(
  id: string,
  status: SellerPayoutStatus,
  note?: string,
) {
  await connectToDatabase();
  const update: Record<string, unknown> = { status };
  if (status === "paid") update.processedAt = new Date();
  if (note) update.note = note;
  return SellerPayout.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: update },
    { new: true },
  ).exec();
}
