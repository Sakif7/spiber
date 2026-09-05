/**
 * Per-admin navigation preferences (pinned favourites + recently visited
 * pages), persisted on the User document so they follow the admin across
 * browsers. This module is pure and framework-free so the same rules run in
 * the API route, the client provider, and the unit tests.
 *
 * Items are referenced by their stable nav `id` (see `components/admin/shell/
 * nav.ts`), never by href, so a route rename doesn't orphan a favourite.
 */

export const MAX_FAVOURITES = 24;
export const MAX_RECENTS = 8;

export type AdminRecent = { id: string; at: string };

export type AdminPrefs = {
  favourites: string[];
  /** Newest first. */
  recents: AdminRecent[];
};

export const EMPTY_PREFS: AdminPrefs = { favourites: [], recents: [] };

/** Add the id when absent, remove it when present (order preserved). */
export function toggleFavourite(favourites: string[], id: string): string[] {
  if (favourites.includes(id)) return favourites.filter((f) => f !== id);
  return [...favourites, id].slice(0, MAX_FAVOURITES);
}

/** Record a visit: move/insert the id to the front, capped at MAX_RECENTS. */
export function pushRecent(
  recents: AdminRecent[],
  id: string,
  at: string = new Date().toISOString(),
): AdminRecent[] {
  return [{ id, at }, ...recents.filter((r) => r.id !== id)].slice(
    0,
    MAX_RECENTS,
  );
}

/**
 * Coerce whatever is stored (or sent) into a valid `AdminPrefs`: unknown ids
 * are dropped (a page may have been removed since), duplicates collapse, and
 * both lists are capped. Dates are normalised to ISO strings.
 */
export function sanitizePrefs(
  raw: unknown,
  isKnownId: (id: string) => boolean,
): AdminPrefs {
  const obj = (raw && typeof raw === "object" ? raw : {}) as {
    favourites?: unknown;
    recents?: unknown;
  };
  const favourites: string[] = [];
  if (Array.isArray(obj.favourites)) {
    for (const f of obj.favourites) {
      if (typeof f === "string" && isKnownId(f) && !favourites.includes(f)) {
        favourites.push(f);
      }
    }
  }
  const recents: AdminRecent[] = [];
  if (Array.isArray(obj.recents)) {
    for (const r of obj.recents) {
      const rec = r as { id?: unknown; at?: unknown };
      if (typeof rec?.id !== "string" || !isKnownId(rec.id)) continue;
      if (recents.some((x) => x.id === rec.id)) continue;
      const at =
        rec.at instanceof Date
          ? rec.at.toISOString()
          : typeof rec.at === "string"
            ? rec.at
            : new Date(0).toISOString();
      recents.push({ id: rec.id, at });
    }
  }
  return {
    favourites: favourites.slice(0, MAX_FAVOURITES),
    recents: recents.slice(0, MAX_RECENTS),
  };
}
