import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Enrollment, type IEnrollment } from "@/lib/models/enrollment";
import type { Lean } from "@/lib/models/_shared";
import type { EnrollmentStatus } from "@/lib/schemas/enrollment";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

export async function getEnrollmentByIdempotencyKey(key: string) {
  await connectToDatabase();
  return Enrollment.findOne({ idempotencyKey: key }).exec();
}

export async function getEnrollmentByNumber(enrollmentNumber: string) {
  await connectToDatabase();
  return Enrollment.findOne({ enrollmentNumber }).exec();
}

export async function getEnrollmentById(id: string) {
  await connectToDatabase();
  return Enrollment.findById(id).exec();
}

export async function getEnrollmentByCertificateId(certificateId: string) {
  await connectToDatabase();
  return Enrollment.findOne({ certificateId }).lean<Lean<IEnrollment>>().exec();
}

/** The student's access record for a course, if they hold one (any non-final state). */
export async function getActiveEnrollment(userId: string, courseId: string) {
  await connectToDatabase();
  return Enrollment.findOne({
    userId,
    courseId,
    status: { $in: ["pending", "active"] },
  }).exec();
}

export async function hasCourseAccess(
  userId: string,
  courseId: string,
): Promise<boolean> {
  await connectToDatabase();
  const e = await Enrollment.findOne({ userId, courseId, status: "active" })
    .select("_id")
    .lean()
    .exec();
  return Boolean(e);
}

export async function listEnrollmentsByUser(userId: string) {
  await connectToDatabase();
  return Enrollment.find({ userId, status: { $in: ["active", "pending"] } })
    .sort({ createdAt: -1 })
    .lean<Lean<IEnrollment>[]>()
    .exec();
}

/** Sort keys the admin enrollments list exposes → stored fields. */
const ENROLLMENT_SORT: Record<string, string> = {
  date: "createdAt",
  number: "enrollmentNumber",
  email: "email",
  status: "status",
  total: "totalMinor",
};

export type EnrollmentListParams = RepoListQuery & {
  courseId?: string;
  status?: EnrollmentStatus;
};

export async function listEnrollments(params: EnrollmentListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.courseId && mongoose.isValidObjectId(params.courseId)) {
    q.courseId = params.courseId;
  }
  if (params.status) q.status = params.status;
  applyPartialSearch(q, params.search, ["enrollmentNumber", "email"]);
  applyDateRange(q, params.from, params.to);
  return paginate<IEnrollment>(Enrollment, q, {
    sort: sortSpec(params.sort, params.dir, ENROLLMENT_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
  });
}

export async function createEnrollment(data: Partial<IEnrollment>) {
  await connectToDatabase();
  return Enrollment.create(data);
}

/** Active-enrollment count + paid revenue, since a timestamp (dashboard KPI). */
export async function enrollmentStatsSince(since: Date) {
  await connectToDatabase();
  const rows = await Enrollment.aggregate<{
    _id: null;
    count: number;
    revenueMinor: number;
  }>([
    { $match: { createdAt: { $gte: since }, status: { $in: ["active"] } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        revenueMinor: { $sum: "$totalMinor" },
      },
    },
  ]).exec();
  return {
    count: rows[0]?.count ?? 0,
    revenueMinor: rows[0]?.revenueMinor ?? 0,
  };
}

/** Enrollment + completion counts per course (admin analytics). */
export async function enrollmentCountsByCourse(courseId: string) {
  await connectToDatabase();
  const courseOid = new mongoose.Types.ObjectId(courseId);
  const [total, active, completed, revenue] = await Promise.all([
    Enrollment.countDocuments({ courseId }),
    Enrollment.countDocuments({ courseId, status: "active" }),
    Enrollment.countDocuments({ courseId, completedAt: { $ne: null } }),
    Enrollment.aggregate<{ _id: null; revenueMinor: number }>([
      { $match: { courseId: courseOid, "payment.status": "paid" } },
      { $group: { _id: null, revenueMinor: { $sum: "$totalMinor" } } },
    ]).exec(),
  ]);
  return {
    total,
    active,
    completed,
    revenueMinor: revenue[0]?.revenueMinor ?? 0,
  };
}
