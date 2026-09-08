import { connectToDatabase } from "@/lib/db/connect";
import { Event, type IEvent } from "@/lib/models/event";
import type { Lean } from "@/lib/models/_shared";
import type { EventStatus } from "@/lib/schemas/events";
import { applyPartialSearch } from "@/lib/repositories/search-filter";
import {
  applyDateRange,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type EventFilter = NonNullable<Parameters<typeof Event.countDocuments>[0]>;

export type EventWhen = "upcoming" | "past" | "all";

/** Upcoming = not yet ended (endDate ≥ now, or single-day startDate ≥ now). */
function whenFilter(when: EventWhen, now: Date): Record<string, unknown> {
  if (when === "upcoming") {
    return {
      $or: [
        { endDate: { $ne: null, $gte: now } },
        { endDate: null, startDate: { $gte: now } },
      ],
    };
  }
  if (when === "past") {
    return {
      $or: [
        { endDate: { $ne: null, $lt: now } },
        { endDate: null, startDate: { $lt: now } },
      ],
    };
  }
  return {};
}

export type PublicEventListParams = {
  when?: EventWhen;
  search?: string;
  page?: number;
  pageSize?: number;
};

// ---- Public ----
export async function listPublishedEvents(params: PublicEventListParams = {}) {
  await connectToDatabase();
  const when = params.when ?? "all";
  const q: Record<string, unknown> = {
    deletedAt: null,
    status: "published",
    ...whenFilter(when, new Date()),
  };
  applyPartialSearch(q, params.search, [
    "title.en",
    "title.bn",
    "summary.en",
    "summary.bn",
    "description.en",
    "description.bn",
  ]);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? 12));
  const sort: Record<string, 1 | -1> =
    when === "upcoming" ? { startDate: 1 } : { startDate: -1 };
  const filter = q as unknown as EventFilter;
  const [items, total] = await Promise.all([
    Event.find(filter)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IEvent>[]>()
      .exec(),
    Event.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getPublishedEventBySlug(slug: string) {
  await connectToDatabase();
  return Event.findOne({ slug, deletedAt: null, status: "published" })
    .lean<Lean<IEvent>>()
    .exec();
}

/** Visible events for the sitemap. */
export async function listVisibleEventsForFeed(limit = 100) {
  await connectToDatabase();
  return Event.find({
    deletedAt: null,
    status: "published",
  } as unknown as EventFilter)
    .sort({ startDate: -1 })
    .limit(limit)
    .lean<Lean<IEvent>[]>()
    .exec();
}

// ---- Admin ----
/** Sort keys the admin list exposes → stored fields. */
const ADMIN_EVENT_SORT: Record<string, string> = {
  start: "startDate",
  date: "createdAt",
  title: "title.en",
  status: "status",
};

export type AdminEventListParams = RepoListQuery & {
  status?: EventStatus;
};

export async function listAdminEvents(params: AdminEventListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  applyPartialSearch(q, params.search, ["title.en", "title.bn", "location.en"]);
  applyDateRange(q, params.from, params.to);
  return paginate<IEvent>(Event, q, {
    sort: sortSpec(params.sort, params.dir, ADMIN_EVENT_SORT, {
      key: "start",
      dir: "desc",
    }),
    page: params.page,
    pageSize: params.pageSize ?? 50,
  });
}

export async function getEventByIdLean(id: string) {
  await connectToDatabase();
  return Event.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IEvent>>()
    .exec();
}

export async function createEvent(data: Partial<IEvent>) {
  await connectToDatabase();
  return Event.create(data);
}

export async function updateEvent(id: string, data: Partial<IEvent>) {
  await connectToDatabase();
  return Event.findOneAndUpdate({ _id: id, deletedAt: null }, data, {
    new: true,
  }).exec();
}

/** Returns false when no such live record exists, so the route can 404. */
export async function softDeleteEvent(id: string): Promise<boolean> {
  await connectToDatabase();
  const res = await Event.updateOne(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  ).exec();
  return res.matchedCount > 0;
}
