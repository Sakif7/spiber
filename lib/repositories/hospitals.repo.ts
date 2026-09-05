import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Hospital, type IHospital } from "@/lib/models/hospital";
import type { Lean } from "@/lib/models/_shared";
import { applyPartialSearch } from "./search-filter";
import type { TourismStatus } from "@/lib/schemas/tourism-catalog";
import { applyDateRange, sortSpec, type RepoListQuery } from "./list-query";

type Filter = NonNullable<Parameters<typeof Hospital.countDocuments>[0]>;

export async function createHospital(data: Partial<IHospital>) {
  await connectToDatabase();
  return Hospital.create(data);
}

export async function getHospitalByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Hospital.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IHospital>>()
    .exec();
}

export async function getActiveHospitalBySlug(slug: string) {
  await connectToDatabase();
  return Hospital.findOne({ slug, status: "active", deletedAt: null })
    .lean<Lean<IHospital>>()
    .exec();
}

export async function getHospitalsByIds(
  ids: (string | mongoose.Types.ObjectId)[],
) {
  await connectToDatabase();
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return [];
  return Hospital.find({ _id: { $in: valid }, deletedAt: null })
    .lean<Lean<IHospital>[]>()
    .exec();
}

/** Sort keys the admin list exposes → stored fields. */
const HOSPITAL_SORT: Record<string, string> = {
  date: "createdAt",
  name: "name.en",
  status: "status",
};

export type HospitalListParams = RepoListQuery & {
  status?: TourismStatus;
  /** Substring match against country (en/bn). */
  country?: string;
  /** Substring match against a specialty (en/bn). */
  specialty?: string;
  /** Exact accreditation tag. */
  accreditation?: string;
  destinationId?: string;
};

export async function listHospitals(params: HospitalListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.destinationId && mongoose.isValidObjectId(params.destinationId)) {
    q.destinationId = params.destinationId;
  }
  if (params.accreditation) q.accreditations = params.accreditation;
  applyPartialSearch(q, params.search, [
    "name.en",
    "name.bn",
    "country.en",
    "country.bn",
    "city.en",
    "city.bn",
  ]);
  applyDateRange(q, params.from, params.to);
  applyPartialSearch(q, params.country, ["country.en", "country.bn"]);
  applyPartialSearch(q, params.specialty, ["specialties.en", "specialties.bn"]);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 24));
  const filter = q as unknown as Filter;
  const [items, total] = await Promise.all([
    Hospital.find(filter)
      .sort(
        params.sort
          ? sortSpec(params.sort, params.dir, HOSPITAL_SORT)
          : { createdAt: -1 },
      )
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IHospital>[]>()
      .exec(),
    Hospital.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listActiveHospitalsForFeed(limit = 100) {
  await connectToDatabase();
  return Hospital.find({ status: "active", deletedAt: null })
    .select("slug updatedAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Lean<IHospital>[]>()
    .exec();
}

export async function updateHospital(id: string, patch: Partial<IHospital>) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Hospital.findOneAndUpdate({ _id: id, deletedAt: null }, patch, {
    new: true,
  })
    .lean<Lean<IHospital>>()
    .exec();
}

export async function softDeleteHospital(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Hospital.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  )
    .lean<Lean<IHospital>>()
    .exec();
}
