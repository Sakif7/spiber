/**
 * URL-state for admin list pages (the shared list kit). The query string is
 * the single source of truth — search, filters, sort and paging all live in
 * it, so every list is shareable, back-button friendly, and server-rendered
 * from the same parsed object. Pure and framework-free: used by server pages,
 * the client toolbar/pagination, and unit tests.
 *
 *   ?q=term&status=paid&store=kart&from=2026-09-01&to=2026-09-30
 *   &sort=total&dir=desc&page=2&size=50
 */

export type SortDir = "asc" | "desc";

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_QUERY_LENGTH = 120;

export type ListQuery = {
  /** Trimmed search term ("" when absent). */
  q: string;
  page: number;
  pageSize: number;
  /** Resolved sort key — always one of the configured `sortable` keys. */
  sort: string;
  dir: SortDir;
  /** Declared filter params that carry a non-empty value. */
  filters: Record<string, string>;
};

export type ListConfig = {
  /** Allowed sort keys (the first is the default unless `defaultSort`). */
  sortable?: readonly string[];
  defaultSort?: string;
  defaultDir?: SortDir;
  /** Filter param names the page understands (status, store, from, to…). */
  filters?: readonly string[];
  defaultPageSize?: number;
  pageSizes?: readonly number[];
};

export type SearchParamsInput = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return "";
}

export function parseListQuery(
  sp: SearchParamsInput,
  cfg: ListConfig = {},
): ListQuery {
  const sizes = cfg.pageSizes ?? PAGE_SIZES;
  const defaultSize = cfg.defaultPageSize ?? DEFAULT_PAGE_SIZE;

  const q = str(sp.q).slice(0, MAX_QUERY_LENGTH);
  const page = Math.max(1, parseInt(str(sp.page) || "1", 10) || 1);
  const sizeRaw = parseInt(str(sp.size) || "", 10);
  const pageSize = sizes.includes(sizeRaw) ? sizeRaw : defaultSize;

  const sortRaw = str(sp.sort);
  const sort = cfg.sortable?.includes(sortRaw)
    ? sortRaw
    : (cfg.defaultSort ?? cfg.sortable?.[0] ?? "");
  const dirRaw = str(sp.dir);
  const dir: SortDir =
    dirRaw === "asc" || dirRaw === "desc" ? dirRaw : (cfg.defaultDir ?? "desc");

  const filters: Record<string, string> = {};
  for (const name of cfg.filters ?? []) {
    const v = str(sp[name]);
    if (v) filters[name] = v.slice(0, MAX_QUERY_LENGTH);
  }

  return { q, page, pageSize, sort, dir, filters };
}

export type ListPatch = Partial<
  Pick<ListQuery, "q" | "page" | "pageSize" | "sort" | "dir">
> & {
  filters?: Record<string, string | undefined>;
};

/**
 * Serialize a query (with an optional patch) back to a query string, omitting
 * values that equal the defaults so URLs stay short. Used by server-rendered
 * links (pagination, chips); client controls patch `URLSearchParams` directly.
 */
export function listQueryString(
  query: ListQuery,
  cfg: ListConfig = {},
  patch: ListPatch = {},
): string {
  const params = new URLSearchParams();
  const q = patch.q ?? query.q;
  if (q) params.set("q", q);

  const filters = { ...query.filters, ...(patch.filters ?? {}) };
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }

  const defaultSort = cfg.defaultSort ?? cfg.sortable?.[0] ?? "";
  const defaultDir = cfg.defaultDir ?? "desc";
  const sort = patch.sort ?? query.sort;
  const dir = patch.dir ?? query.dir;
  if (sort && (sort !== defaultSort || dir !== defaultDir)) {
    params.set("sort", sort);
    if (dir !== defaultDir) params.set("dir", dir);
  }

  const pageSize = patch.pageSize ?? query.pageSize;
  if (pageSize !== (cfg.defaultPageSize ?? DEFAULT_PAGE_SIZE)) {
    params.set("size", String(pageSize));
  }
  const page = patch.page ?? query.page;
  if (page > 1) params.set("page", String(page));

  return params.toString();
}

export function listHref(
  basePath: string,
  query: ListQuery,
  cfg: ListConfig = {},
  patch: ListPatch = {},
): string {
  const qs = listQueryString(query, cfg, patch);
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Parse an ISO `YYYY-MM-DD` filter value into a UTC day boundary. `end` gives
 * the exclusive end of that day, so `createdAt: { $gte: start, $lt: end }`
 * covers whole days regardless of time zone.
 */
export function dayBounds(value: string | undefined): {
  start: Date;
  end: Date;
} | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const start = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end: new Date(start.getTime() + 86_400_000) };
}
