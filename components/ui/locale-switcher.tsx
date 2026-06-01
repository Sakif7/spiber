"use client";

import { useTransition, type CSSProperties } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { en: "EN", bn: "বাং" };

/**
 * Toggles the active locale while preserving the current path. Uses next-intl
 * locale-aware navigation so the URL prefix updates correctly.
 */
export function LocaleSwitcher({ style }: { style?: CSSProperties }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        borderRadius: "var(--r-pill)",
        background: "var(--color-surface-2)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        opacity: isPending ? 0.6 : 1,
        ...style,
      }}
    >
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            aria-pressed={active}
            onClick={() =>
              startTransition(() => router.replace(pathname, { locale: l }))
            }
            style={{
              border: 0,
              cursor: "pointer",
              padding: "5px 10px",
              borderRadius: "var(--r-pill)",
              fontFamily: "inherit",
              fontWeight: 600,
              background: active ? "var(--color-brand)" : "transparent",
              color: active ? "#fff" : "var(--color-text-muted)",
              transition: "background 180ms, color 180ms",
            }}
          >
            {LABELS[l] ?? l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
