"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Loads one record for an edit panel.
 *
 * Most edit panels take their record straight from the list row, which costs
 * nothing. The four big editors cannot: a post's body, a course's whole
 * curriculum and a product's variants would be sent for every visible row, so
 * those ask for the one record being opened. The panel only mounts its
 * children when it opens, so this fires exactly once, when someone actually
 * wants the form.
 */
export function useRecord<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const res = await fetch(endpoint, {
          cache: "no-store",
          signal: abort.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(
            json?.error?.code === "not_found"
              ? "That record no longer exists."
              : "Could not load this record.",
          );
          return;
        }
        setData(json.data as T);
      } catch (e) {
        // An abort is the panel closing, not a failure.
        if ((e as Error)?.name !== "AbortError")
          setError("Could not load this record.");
      }
    })();
    return () => abort.abort();
  }, [endpoint]);

  return { data, error };
}

/** What the panel shows while the record is on its way, or if it never came. */
export function RecordPending({ error }: { error?: string | null }) {
  if (error)
    return (
      <p role="alert" className="text-destructive py-8 text-center font-medium">
        {error}
      </p>
    );
  return (
    <div className="text-muted-foreground flex items-center justify-center gap-2 py-16">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>Loading…</span>
    </div>
  );
}
