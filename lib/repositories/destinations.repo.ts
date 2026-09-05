import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Destination, type IDestination } from "@/lib/models/destination";
import type { Lean } from "@/lib/models/_shared";
import { applyPartialSearch } from "./search-filter";
import type { TourismStatus } from "@/lib/schemas/tourism-catalog";
import { applyDateRange, sortSpec, type RepoListQuery } from "./list-query";

type Filter = NonNullable<Parameters<typeof Destination.countDocuments>[0]>;

export async function createDestination(data: Partial<IDestination>) {
  await connectToDatabase();
  return Destination.create(data);
}

export async function getDestinationByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Destination.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IDestination>>()
    .exec();
}

export async function getActiveDestinationBySlug(slug: string) {
  await connectToDatabase();
  return Destination.findOne({ slug, status: "active", deletedAt: null })
    .lean<Lean<IDestination>>()
    .exec();
}

export async function getDestinationsByIds(
  ids: (string | mongoose.Types.ObjectId)[],
) {
  await connectToDatabase();
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return [];
  return Destination.find({ _id: { $in: valid }, deletedAt: null })
    .lean<Lean<IDestination>[]>()
    .exec();
}

/** Sort keys the admin list exposes → stored fields. */
const DESTINATION_SORT: Record<string, string> = {
  date: "createdAt",
  name: "name.en",
  status: "status",
};

export type DestinationListParams = RepoListQuery & {
  status?: TourismStatus;
  featured?: boolean;
};

export async function listDestinations(params: DestinationListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.featured != null) q.featured = params.featured;
  applyPartialSearch(q, params.search, [
    "name.en",
    "name.bn",
    "overview.en",
    "overview.bn",
  ]);
  applyDateRange(q, params.from, params.to);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 24));
  const filter = q as unknown as Filter;
  const [items, total] = await Promise.all([
    Destination.find(filter)
      .sort(
        params.sort
          ? sortSpec(params.sort, params.dir, DESTINATION_SORT)
          : { featured: -1, createdAt: -1 },
      )
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IDestination>[]>()
      .exec(),
    Destination.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listActiveDestinationsForFeed(limit = 100) {
  await connectToDatabase();
  return Destination.find({ status: "active", deletedAt: null })
    .select("slug updatedAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Lean<IDestination>[]>()
    .exec();
}

export async function updateDestination(
  id: string,
  patch: Partial<IDestination>,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Destination.findOneAndUpdate({ _id: id, deletedAt: null }, patch, {
    new: true,
  })
    .lean<Lean<IDestination>>()
    .exec();
}

export async function softDeleteDestination(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Destination.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  )
    .lean<Lean<IDestination>>()
    .exec();
}
