import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Doctor, type IDoctor } from "@/lib/models/doctor";
import type { Lean } from "@/lib/models/_shared";
import { applyPartialSearch } from "./search-filter";
import type { TourismStatus } from "@/lib/schemas/tourism-catalog";
import { applyDateRange, sortSpec, type RepoListQuery } from "./list-query";

type Filter = NonNullable<Parameters<typeof Doctor.countDocuments>[0]>;

export async function createDoctor(data: Partial<IDoctor>) {
  await connectToDatabase();
  return Doctor.create(data);
}

export async function getDoctorByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Doctor.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IDoctor>>()
    .exec();
}

export async function getActiveDoctorBySlug(slug: string) {
  await connectToDatabase();
  return Doctor.findOne({ slug, status: "active", deletedAt: null })
    .lean<Lean<IDoctor>>()
    .exec();
}

/** Sort keys the admin list exposes → stored fields. */
const DOCTOR_SORT: Record<string, string> = {
  date: "createdAt",
  name: "name",
  status: "status",
};

export type DoctorListParams = RepoListQuery & {
  status?: TourismStatus;
  /** Substring match against specialty (en/bn). */
  specialty?: string;
  onlineConsultation?: boolean;
  hospitalId?: string;
};

export async function listDoctors(params: DoctorListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.onlineConsultation != null) {
    q.onlineConsultation = params.onlineConsultation;
  }
  if (params.hospitalId && mongoose.isValidObjectId(params.hospitalId)) {
    q.hospitalId = params.hospitalId;
  }
  applyPartialSearch(q, params.search, [
    "name",
    "specialty.en",
    "specialty.bn",
  ]);
  applyDateRange(q, params.from, params.to);
  applyPartialSearch(q, params.specialty, ["specialty.en", "specialty.bn"]);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 24));
  const filter = q as unknown as Filter;
  const [items, total] = await Promise.all([
    Doctor.find(filter)
      .sort(
        params.sort
          ? sortSpec(params.sort, params.dir, DOCTOR_SORT)
          : { createdAt: -1 },
      )
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IDoctor>[]>()
      .exec(),
    Doctor.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listDoctorsByHospital(hospitalId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(hospitalId)) return [];
  return Doctor.find({ hospitalId, status: "active", deletedAt: null })
    .sort({ createdAt: -1 })
    .lean<Lean<IDoctor>[]>()
    .exec();
}

export async function listActiveDoctorsForFeed(limit = 100) {
  await connectToDatabase();
  return Doctor.find({ status: "active", deletedAt: null })
    .select("slug updatedAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Lean<IDoctor>[]>()
    .exec();
}

export async function updateDoctor(id: string, patch: Partial<IDoctor>) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Doctor.findOneAndUpdate({ _id: id, deletedAt: null }, patch, {
    new: true,
  })
    .lean<Lean<IDoctor>>()
    .exec();
}

export async function softDeleteDoctor(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Doctor.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  )
    .lean<Lean<IDoctor>>()
    .exec();
}
