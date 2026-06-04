import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Banner, type IBanner } from "@/lib/models/banner";
import type { Lean } from "@/lib/models/_shared";
import type { BannerSlot } from "@/lib/schemas/banner";

/** Active banners for a slot, respecting an optional schedule window. */
export async function listActiveBanners(
  slot: BannerSlot,
  now: Date = new Date(),
): Promise<Lean<IBanner>[]> {
  await connectToDatabase();
  return Banner.find({
    slot,
    active: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  })
    .sort({ position: 1, createdAt: -1 })
    .lean<Lean<IBanner>[]>()
    .exec();
}

export async function listAllBanners(): Promise<Lean<IBanner>[]> {
  await connectToDatabase();
  return Banner.find({})
    .sort({ slot: 1, position: 1 })
    .lean<Lean<IBanner>[]>()
    .exec();
}

export async function getBannerById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Banner.findById(id).lean<Lean<IBanner>>().exec();
}

export async function createBanner(data: Partial<IBanner>) {
  await connectToDatabase();
  return Banner.create(data);
}

export async function updateBanner(id: string, data: Partial<IBanner>) {
  await connectToDatabase();
  return Banner.findByIdAndUpdate(id, data, { new: true }).exec();
}

export async function deleteBanner(id: string) {
  await connectToDatabase();
  await Banner.deleteOne({ _id: id }).exec();
}
