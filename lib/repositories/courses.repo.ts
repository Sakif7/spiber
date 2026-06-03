import { connectToDatabase } from "@/lib/db/connect";
import { Course, type ICourse, type ILesson } from "@/lib/models/course";
import type { Lean } from "@/lib/models/_shared";
import type { CourseLevel, CourseStatus } from "@/lib/schemas/academy";
import { applyPartialSearch } from "@/lib/repositories/search-filter";

// Version-agnostic Mongoose filter type (Mongoose 9 renamed FilterQuery).
type CourseFilter = NonNullable<Parameters<typeof Course.countDocuments>[0]>;

export type CourseSort = "newest" | "price_asc" | "price_desc";

export type CourseListParams = {
  level?: CourseLevel;
  search?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  status?: CourseStatus;
  sort?: CourseSort;
  page?: number;
  pageSize?: number;
};

function buildQuery(params: CourseListParams): Record<string, unknown> {
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.level) q.level = params.level;
  if (params.minPriceMinor != null || params.maxPriceMinor != null) {
    const price: Record<string, number> = {};
    if (params.minPriceMinor != null) price.$gte = params.minPriceMinor;
    if (params.maxPriceMinor != null) price.$lte = params.maxPriceMinor;
    q.priceMinor = price;
  }
  applyPartialSearch(q, params.search, [
    "title.en",
    "title.bn",
    "summary.en",
    "summary.bn",
  ]);
  return q;
}

export async function listCourses(params: CourseListParams) {
  await connectToDatabase();
  const q = buildQuery(params);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, params.pageSize ?? 12));
  const sort: Record<string, 1 | -1> =
    params.sort === "price_asc"
      ? { priceMinor: 1 }
      : params.sort === "price_desc"
        ? { priceMinor: -1 }
        : { createdAt: -1 };

  const filter = q as unknown as CourseFilter;
  const [items, total] = await Promise.all([
    Course.find(filter)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<ICourse>[]>()
      .exec(),
    Course.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getCourseBySlug(slug: string) {
  await connectToDatabase();
  return Course.findOne({ slug, deletedAt: null }).lean<Lean<ICourse>>().exec();
}

export async function getCourseById(id: string) {
  await connectToDatabase();
  return Course.findOne({ _id: id, deletedAt: null }).exec();
}

export async function getCourseByIdLean(id: string) {
  await connectToDatabase();
  return Course.findOne({ _id: id, deletedAt: null })
    .lean<Lean<ICourse>>()
    .exec();
}

export async function createCourse(data: Partial<ICourse>) {
  await connectToDatabase();
  return Course.create(data);
}

export async function updateCourse(id: string, data: Partial<ICourse>) {
  await connectToDatabase();
  return Course.findByIdAndUpdate(id, data, { new: true }).exec();
}

export async function softDeleteCourse(id: string) {
  await connectToDatabase();
  await Course.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date(), status: "archived" } },
  ).exec();
}

/** Flatten a course's lessons in display order (modules → lessons by `order`). */
export function flattenLessons(course: Pick<ICourse, "modules">): ILesson[] {
  return [...course.modules]
    .sort((a, b) => a.order - b.order)
    .flatMap((m) => [...m.lessons].sort((a, b) => a.order - b.order));
}

/** Find a single lesson (and its module) by stable lessonId. */
export function findLesson(
  course: Pick<ICourse, "modules">,
  lessonId: string,
): ILesson | null {
  for (const m of course.modules) {
    const l = m.lessons.find((x) => x.id === lessonId);
    if (l) return l;
  }
  return null;
}
