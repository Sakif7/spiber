"use client";

import { CSSProperties, useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";

/**
 * Debounced, URL-driven search box. As the user types it rewrites the `paramKey`
 * query param (after they pause) and soft-navigates — no submit button needed.
 * The surrounding server component re-renders with filtered results while this
 * client input stays mounted, so focus and the typed value are preserved.
 *
 * It preserves every other current query param (brand, price, sort…) and resets
 * pagination. Enter searches immediately; Escape / the clear button reset it.
 */
export function LiveSearch({
  placeholder,
  ariaLabel,
  paramKey = "q",
  size = "md",
  delay = 350,
  style,
}: {
  placeholder: string;
  ariaLabel: string;
  paramKey?: string;
  size?: "sm" | "md";
  delay?: number;
  style?: CSSProperties;
}) {
  const t = useTranslations("search");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState(searchParams.get(paramKey) ?? "");
  const [focused, setFocused] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Build the next URL from the live params and navigate — but only when the
  // term actually changed, so redundant keystrokes/Enter don't re-fetch.
  const commit = useCallback(
    (next: string) => {
      const term = next.trim();
      if (term === (searchParams.get(paramKey) ?? "")) return;
      const params = new URLSearchParams(searchParams.toString());
      if (term) params.set(paramKey, term);
      else params.delete(paramKey);
      params.delete("page"); // new query → back to page 1
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [searchParams, paramKey, pathname, router],
  );

  const debouncedCommit = useDebouncedCallback(commit, delay);

  const onClear = useCallback(() => {
    debouncedCommit.cancel();
    setValue("");
    commit("");
  }, [commit, debouncedCommit]);

  const dims =
    size === "sm" ? { h: 40, fs: 14, icon: 16 } : { h: 46, fs: 15, icon: 18 };

  const pill: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    height: dims.h,
    padding: "0 6px 0 14px",
    border: `1px solid ${focused ? "var(--brand-teal)" : "var(--color-border-field)"}`,
    borderRadius: "var(--r-pill)",
    background: "var(--color-surface)",
    boxShadow: focused
      ? "0 0 0 4px color-mix(in oklab, var(--brand-teal) 12%, transparent)"
      : "none",
    transition: "border-color .15s, box-shadow .15s",
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        debouncedCommit.cancel();
        commit(value);
      }}
      style={{ position: "relative", width: "100%", ...style }}
    >
      <div style={pill}>
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            width: dims.icon,
            height: dims.icon,
            flexShrink: 0,
          }}
        >
          {isPending ? (
            <svg
              className="catalog-search-spinner"
              width={dims.icon}
              height={dims.icon}
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="8.5"
                stroke="var(--color-border)"
                strokeWidth="2.4"
              />
              <path
                d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"
                stroke="var(--brand-teal)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              width={dims.icon}
              height={dims.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--brand-teal)"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          )}
        </span>

        <input
          type="search"
          name={paramKey}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            debouncedCommit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && value) {
              e.preventDefault();
              onClear();
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            font: "inherit",
            fontSize: dims.fs,
            color: "var(--color-text-strong)",
          }}
        />

        {value && (
          <button
            type="button"
            onClick={onClear}
            aria-label={t("clear")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: dims.h - 12,
              height: dims.h - 12,
              flexShrink: 0,
              border: "none",
              borderRadius: 999,
              background: "var(--color-surface-2)",
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
