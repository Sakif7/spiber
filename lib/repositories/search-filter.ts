/**
 * Partial, typeahead-friendly text matching for catalog search.
 *
 * MongoDB's `$text` operator matches whole *stemmed words* — so "digit" finds
 * "Digital" but "digi" finds nothing, and "thermomet" finds "Thermometer" but
 * "thermome" does not. That is the wrong model for as-you-type search, where
 * users expect fragments to match. These helpers build a case-insensitive
 * *substring* filter instead, which works on partial words and (via per-term
 * AND) reordered multi-word queries.
 *
 * Trade-off: unanchored regex can't use a btree index, so each query is a
 * collection scan. That is fine for the current catalog sizes (and queries are
 * already narrowed by `status`/visibility). If a catalog grows large, move to
 * an indexed prefix field or a dedicated search engine (e.g. Atlas Search).
 */

const MAX_TERMS = 6;
const MAX_TERM_LEN = 64;

/** Escape user input for safe, literal use inside a RegExp. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a Mongo filter where every whitespace-separated term in `term` must
 * appear (case-insensitive substring) in at least one of `fields`. Returns
 * `null` when there is nothing searchable, so callers can skip it.
 *
 * Example: `partialMatchFilter("digi", ["name.en", "name.bn"])` →
 *   { $and: [ { $or: [ { "name.en": /digi/i }, { "name.bn": /digi/i } ] } ] }
 */
export function partialMatchFilter(
  term: string,
  fields: string[],
): Record<string, unknown> | null {
  const terms = term
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TERMS)
    .map((t) => t.slice(0, MAX_TERM_LEN));
  if (terms.length === 0 || fields.length === 0) return null;

  return {
    $and: terms.map((t) => {
      const rx = new RegExp(escapeRegex(t), "i");
      return { $or: fields.map((f) => ({ [f]: rx })) };
    }),
  };
}

/**
 * Merge a partial-match filter into an existing query object under `$and` so it
 * composes cleanly with the query's other top-level conditions. No-op when the
 * term yields nothing.
 */
export function applyPartialSearch(
  query: Record<string, unknown>,
  term: string | undefined | null,
  fields: string[],
): void {
  if (!term) return;
  const filter = partialMatchFilter(term, fields);
  if (!filter) return;
  // Merge into any pre-existing $and rather than clobbering it.
  const existing = query.$and;
  if (Array.isArray(existing)) {
    query.$and = [...existing, ...(filter.$and as unknown[])];
  } else {
    Object.assign(query, filter);
  }
}
