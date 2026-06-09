/**
 * Wire types for unified catalog search — deliberately free of any server
 * imports (no Mongoose, no repositories) so the client typeahead component can
 * import them without dragging server code into the browser bundle.
 *
 * The four divisions that participate in unified search. Order here is the
 * order groups are rendered in the dropdown and on the results page.
 */
export const SEARCH_GROUP_KEYS = [
  "instruments",
  "marketplace",
  "academy",
  "systems",
  "blog",
] as const;

export type SearchGroupKey = (typeof SEARCH_GROUP_KEYS)[number];

/** A single, render-ready search result for the typeahead dropdown. */
export type SearchHit = {
  id: string;
  group: SearchGroupKey;
  /** Already localized for the requested locale. */
  title: string;
  /** Already formatted (price / reading time / "On request"). */
  subtitle?: string;
  /** Locale-relative detail path, e.g. `/medtrade/product/slug`. */
  href: string;
  /** Cover/first image URL, if any. */
  image?: string | null;
};

/** One division's slice of the dropdown results. */
export type SearchGroupDTO = {
  key: SearchGroupKey;
  /** Total matches in this division (may exceed `hits.length`). */
  total: number;
  hits: SearchHit[];
};

/** Shape returned in the `data` envelope from GET /api/search. */
export type SearchResponseDTO = {
  query: string;
  total: number;
  groups: SearchGroupDTO[];
};
