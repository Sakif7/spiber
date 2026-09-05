"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { cn } from "@/lib/cn";

/**
 * Debounced text search for admin list pages. The URL query param is the
 * source of truth (shareable, back-button friendly): typing rewrites `?q=`
 * via `router.replace` inside a transition — no overlay, no scroll jump —
 * while preserving every other param and resetting `page`. Enter commits at
 * once; Escape and the × button clear. The input stays mounted across the
 * server re-render, so focus and the typed value survive.
 */
export function ListSearch({
  param = "q",
  placeholder = "Search…",
  ariaLabel,
  className,
}: {
  param?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? "";

  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  // Resync when the URL changes from elsewhere (chips, Reset, back/forward):
  // React's adjust-state-during-render pattern, no effect needed.
  const [prevCurrent, setPrevCurrent] = useState(current);
  if (prevCurrent !== current) {
    setPrevCurrent(current);
    setValue(current);
  }

  function commit(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    const v = next.trim();
    if (v) params.set(param, v);
    else params.delete(param);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  const debounced = useDebouncedCallback((next: string) => {
    if (next.trim() !== current) commit(next);
  }, 350);

  function clear() {
    debounced.cancel();
    setValue("");
    if (current) commit("");
  }

  return (
    <div className={cn("relative", className)}>
      <Search
        size={15}
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
      />
      <Input
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value);
          debounced(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            debounced.cancel();
            commit(value);
          } else if (e.key === "Escape") {
            clear();
          }
        }}
        className="pr-8 pl-8"
      />
      <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
        {pending ? (
          <Loader2
            size={14}
            aria-hidden
            className="text-muted-foreground animate-spin"
          />
        ) : value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground rounded p-0.5"
          >
            <X size={14} aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  );
}
