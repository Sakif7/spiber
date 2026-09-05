import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Banner, type IBanner } from "@/lib/models/banner";
import type { Lean } from "@/lib/models/_shared";
import type { BannerSlot } from "@/lib/schemas/banner";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

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

/** Sort keys the admin banners list exposes → stored fields. */
const BANNER_SORT: Record<string, string> = {
  position: "position",
  date: "createdAt",
  title: "title.en",
  slot: "slot",
  active: "active",
};

export type BannerAdminListParams = RepoListQuery & {
  slot?: BannerSlot;
  active?: boolean;
};

/** Searchable, sortable, paged banner list for the admin (list kit). */
export async function listBannersForAdmin(params: BannerAdminListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.slot) q.slot = params.slot;
  if (params.active != null) q.active = params.active;
  applyPartialSearch(q, params.search, ["title.en", "title.bn"]);
  applyDateRange(q, params.from, params.to);
  return paginate<IBanner>(Banner, q, {
    sort: sortSpec(params.sort, params.dir, BANNER_SORT, {
      key: "position",
      dir: "asc",
    }),
    page: params.page,
    pageSize: params.pageSize,
  });
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
