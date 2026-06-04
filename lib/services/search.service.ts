import { listProducts } from "@/lib/repositories/products.repo";
import { listCourses } from "@/lib/repositories/courses.repo";
import { listSoftwareProducts } from "@/lib/repositories/software.repo";
import { listPublishedPosts } from "@/lib/repositories/blog.repo";
import type { Lean } from "@/lib/models/_shared";
import type { IProduct } from "@/lib/models/product";
import type { ICourse } from "@/lib/models/course";
import type { ISoftwareProduct } from "@/lib/models/softwareProduct";
import type { IBlogPost } from "@/lib/models/blogPost";
import { logger } from "@/lib/log";

type Slice<T> = { items: Lean<T>[]; total: number };

export type SearchResults = {
  /** Instruments-storefront products (catalog / quotation). */
  products: Slice<IProduct>;
  /** Marketplace-storefront products (retail checkout). */
  marketplace: Slice<IProduct>;
  courses: Slice<ICourse>;
  software: Slice<ISoftwareProduct>;
  posts: Slice<IBlogPost>;
};

const EMPTY = <T>(): Slice<T> => ({ items: [], total: 0 });

/**
 * Each division search is isolated: an unreachable collection (or query error)
 * degrades that one slice to empty instead of failing the whole search. We log
 * so the gap is visible without breaking the response.
 */
async function safeSlice<T>(
  label: string,
  run: () => Promise<{ items: Lean<T>[]; total: number }>,
): Promise<Slice<T>> {
  try {
    const r = await run();
    return { items: r.items, total: r.total };
  } catch (e) {
    logger.warn(`search slice failed: ${label}`, e);
    return EMPTY<T>();
  }
}

/**
 * Unified, public-visibility-filtered search across the four searchable
 * divisions. Returns lean documents so callers can render the existing result
 * cards (results page) or map to lightweight hits (typeahead API).
 *
 * `perGroup` caps each division independently (the typeahead wants a few, the
 * results page wants more). An empty/whitespace query short-circuits.
 */
export async function searchAll(
  query: string,
  opts: { perGroup?: number } = {},
): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) {
    return {
      products: EMPTY(),
      marketplace: EMPTY(),
      courses: EMPTY(),
      software: EMPTY(),
      posts: EMPTY(),
    };
  }
  const perGroup = Math.min(24, Math.max(1, opts.perGroup ?? 6));

  const [products, marketplace, courses, software, posts] = await Promise.all([
    safeSlice<IProduct>("instruments", () =>
      listProducts({
        storefront: "instruments",
        status: "active",
        search: q,
        pageSize: perGroup,
      }),
    ),
    safeSlice<IProduct>("marketplace", () =>
      listProducts({
        storefront: "marketplace",
        status: "active",
        search: q,
        pageSize: perGroup,
      }),
    ),
    safeSlice<ICourse>("academy", () =>
      listCourses({ status: "published", search: q, pageSize: perGroup }),
    ),
    safeSlice<ISoftwareProduct>("systems", () =>
      listSoftwareProducts({ status: "active", search: q, pageSize: perGroup }),
    ),
    safeSlice<IBlogPost>("blog", () =>
      listPublishedPosts({ search: q, pageSize: perGroup }),
    ),
  ]);

  return { products, marketplace, courses, software, posts };
}

/** Total matches across all divisions (capped by `perGroup` per slice). */
export function totalResults(r: SearchResults): number {
  return (
    r.products.total +
    r.marketplace.total +
    r.courses.total +
    r.software.total +
    r.posts.total
  );
}
