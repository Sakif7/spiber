import type { Model } from "mongoose";
import type { Lean } from "@/lib/models/_shared";
import { dayBounds, type SortDir } from "@/lib/admin/list-params";
import { applyPartialSearch } from "./search-filter";

/**
 * Shared repository helpers for admin list pages: one place for search,
 * sorting, date ranges and paging so every list behaves the same and a repo
 * gains all four in a few lines.
 */

/** The list-kit inputs a repo list function accepts (all optional). */
export type RepoListQuery = {
  search?: string;
  sort?: string;
  dir?: SortDir;
  page?: number;
  pageSize?: number;
  /** ISO YYYY-MM-DD bounds on the date field (inclusive days). */
  from?: string;
  to?: string;
};

export type Paged<T> = {
  items: Lean<T>[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

export const EMPTY_PAGE = <T>(pageSize = 25): Paged<T> => ({
  items: [],
  total: 0,
  page: 1,
  pageSize,
  pages: 1,
});

/**
 * Build a Mongo sort spec from a whitelisted sort key. `map` translates a
 * public sort key to the stored field (e.g. `{ date: "createdAt", total:
 * "totalMinor" }`); unknown keys fall back. `_id` is appended as a stable
 * tiebreak so paging never skips or repeats rows on equal values.
 */
export function sortSpec(
  sort: string | undefined,
  dir: SortDir | undefined,
  map: Record<string, string>,
  fallback: { key: string; dir: SortDir } = { key: "date", dir: "desc" },
): Record<string, 1 | -1> {
  const known =
    sort !== undefined && Object.prototype.hasOwnProperty.call(map, sort);
  const key = known ? (sort as string) : fallback.key;
  const field = map[key] ?? "createdAt";
  const d = (known ? dir : undefined) ?? fallback.dir;
  const spec: Record<string, 1 | -1> = { [field]: d === "asc" ? 1 : -1 };
  if (field !== "_id") spec._id = -1;
  return spec;
}

/** Merge a `from`/`to` day range on `field` into the filter (no-op when unset). */
export function applyDateRange(
  filter: Record<string, unknown>,
  from: string | undefined,
  to: string | undefined,
  field = "createdAt",
): void {
  const a = dayBounds(from);
  const b = dayBounds(to);
  if (!a && !b) return;
  const range: Record<string, Date> = {};
  if (a) range.$gte = a.start;
  if (b) range.$lt = b.end;
  filter[field] = range;
}

export { applyPartialSearch };

/**
 * Run a paged query + count in parallel and return the list-kit page shape.
 * `pageSize` is clamped to `maxPageSize` (default 100) so a crafted URL can
 * never pull a whole collection.
 */
export async function paginate<T>(
  model: Model<T>,
  filter: Record<string, unknown>,
  opts: {
    sort: Record<string, 1 | -1>;
    page?: number;
    pageSize?: number;
    maxPageSize?: number;
  },
): Promise<Paged<T>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(
    opts.maxPageSize ?? 100,
    Math.max(1, opts.pageSize ?? 25),
  );
  const f = filter as unknown as NonNullable<
    Parameters<Model<T>["countDocuments"]>[0]
  >;
  const [items, total] = await Promise.all([
    model
      .find(f)
      .sort(opts.sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<T>[]>()
      .exec(),
    model.countDocuments(f),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
