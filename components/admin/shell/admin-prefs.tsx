"use client";

import { createContext, useCallback, useContext, useState } from "react";
import {
  EMPTY_PREFS,
  pushRecent,
  toggleFavourite as toggleFav,
  type AdminPrefs,
} from "@/lib/admin/prefs";

type AdminPrefsContextValue = {
  prefs: AdminPrefs;
  isFavourite: (id: string) => boolean;
  toggleFavourite: (id: string) => void;
  recordVisit: (id: string) => void;
};

const AdminPrefsContext = createContext<AdminPrefsContextValue | null>(null);

async function save(body: { favourites?: string[]; recent?: string }) {
  try {
    const res = await fetch("/api/admin/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    const prefs = json?.data?.prefs ?? json?.prefs;
    return res.ok && prefs ? (prefs as AdminPrefs) : null;
  } catch {
    return null;
  }
}

/**
 * Holds the signed-in admin's favourites + recents. The server-rendered
 * initial value comes from the layout (no flash of an empty favourites block);
 * updates are optimistic and persisted through PATCH /api/admin/prefs. A
 * failed save simply leaves the optimistic state — it is a convenience
 * preference, never business data.
 */
export function AdminPrefsProvider({
  initial,
  children,
}: {
  initial?: AdminPrefs;
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useState<AdminPrefs>(initial ?? EMPTY_PREFS);

  const isFavourite = useCallback(
    (id: string) => prefs.favourites.includes(id),
    [prefs.favourites],
  );

  const toggleFavourite = useCallback(
    (id: string) => {
      // Compute from the committed state (never inside the updater — React
      // may defer running updaters, so a value captured there is unreliable).
      const next = toggleFav(prefs.favourites, id);
      setPrefs((p) => ({ ...p, favourites: next }));
      void save({ favourites: next }).then((saved) => {
        if (saved) setPrefs((p) => ({ ...p, favourites: saved.favourites }));
      });
    },
    [prefs.favourites],
  );

  const recordVisit = useCallback((id: string) => {
    setPrefs((p) => ({ ...p, recents: pushRecent(p.recents, id) }));
    void save({ recent: id });
  }, []);

  return (
    <AdminPrefsContext.Provider
      value={{ prefs, isFavourite, toggleFavourite, recordVisit }}
    >
      {children}
    </AdminPrefsContext.Provider>
  );
}

export function useAdminPrefs(): AdminPrefsContextValue {
  const ctx = useContext(AdminPrefsContext);
  if (!ctx) {
    throw new Error("useAdminPrefs must be used inside AdminPrefsProvider");
  }
  return ctx;
}
