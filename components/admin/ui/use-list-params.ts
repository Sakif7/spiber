"use client";

import { useCallback, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * One way to change list URL state from client controls (search, filters,
 * sort, paging). Patches are merged into the current query string; empty
 * values delete the param; any change other than paging resets `page`.
 * Navigations run inside a transition so the control shows its own pending
 * state while the server re-renders the list — no full-page overlay.
 */
export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = useCallback(
    (
      patch: Record<string, string | undefined>,
      opts: { resetPage?: boolean; push?: boolean } = {},
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "" || (k === "page" && v === "1")) {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      }
      if (opts.resetPage !== false) params.delete("page");
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        // Paging gets a history entry and scrolls to the top of the new page;
        // everything else replaces in place and keeps the scroll position.
        if (opts.push) router.push(url);
        else router.replace(url, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return { searchParams, set, pending };
}
