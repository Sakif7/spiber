"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const META: Record<string, { code: string; label: string }> = {
  en: { code: "EN", label: "English" },
  bn: { code: "BN", label: "বাংলা" },
  ja: { code: "JA", label: "日本語" },
};

/**
 * Language dropdown: shows the current locale's flag + code (EN = UK flag,
 * BN = Bangladesh flag). Opens a small menu to switch, preserving the path via
 * next-intl locale-aware navigation.
 */
export function LocaleSwitcher({ style }: { style?: CSSProperties }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(l: string) {
    setOpen(false);
    if (l === locale) return;
    startTransition(() => router.replace(pathname, { locale: l }));
  }

  const cur = META[locale] ?? { code: locale.toUpperCase(), label: locale };

  return (
    <div ref={ref} style={{ position: "relative", ...style }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 9px",
          borderRadius: "var(--r-pill)",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-text)",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        <Flag locale={locale} />
        {cur.code}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 180ms",
          }}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 150,
            padding: 5,
            borderRadius: "var(--r-lg)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-hairline)",
            boxShadow:
              "0 1px 2px rgba(10,31,44,.06), 0 18px 40px -14px rgba(10,31,44,.26)",
            zIndex: 90,
          }}
        >
          {routing.locales.map((l) => {
            const m = META[l] ?? { code: l.toUpperCase(), label: l };
            const active = l === locale;
            return (
              <button
                key={l}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => choose(l)}
                className="locale-opt"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 10px",
                  borderRadius: "var(--r-md)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 13,
                  background: active
                    ? "var(--color-brand-soft)"
                    : "transparent",
                  color: active
                    ? "var(--color-brand-deep)"
                    : "var(--color-text)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <Flag locale={l} />
                <span style={{ flex: 1 }}>{m.label}</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {m.code}
                </span>
              </button>
            );
          })}
          <style>{`.locale-opt:hover { background: var(--color-surface-2); }`}</style>
        </div>
      )}
    </div>
  );
}

function Flag({ locale }: { locale: string }) {
  if (locale === "bn") return <BdFlag />;
  if (locale === "ja") return <JpFlag />;
  return <UkFlag />;
}

/** Union Jack (EN). */
function UkFlag() {
  const raw = useId().replace(/[:]/g, "");
  return (
    <svg
      width="22"
      height="13"
      viewBox="0 0 60 30"
      aria-hidden
      style={{ borderRadius: 2, display: "block", flexShrink: 0 }}
    >
      <clipPath id={`s${raw}`}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id={`t${raw}`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath={`url(#s${raw})`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path
          d="M0,0 L60,30 M60,0 L0,30"
          clipPath={`url(#t${raw})`}
          stroke="#C8102E"
          strokeWidth="4"
        />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

/** Bangladesh (BN). */
function BdFlag() {
  return (
    <svg
      width="22"
      height="13"
      viewBox="0 0 60 36"
      aria-hidden
      style={{ borderRadius: 2, display: "block", flexShrink: 0 }}
    >
      <rect width="60" height="36" fill="#006a4e" />
      <circle cx="27" cy="18" r="11" fill="#f42a41" />
    </svg>
  );
}

/** Japan (JA). */
function JpFlag() {
  return (
    <svg
      width="22"
      height="13"
      viewBox="0 0 60 36"
      aria-hidden
      style={{ borderRadius: 2, display: "block", flexShrink: 0 }}
    >
      <rect width="60" height="36" fill="#fff" stroke="#eee" strokeWidth="1" />
      <circle cx="30" cy="18" r="10.8" fill="#bc002d" />
    </svg>
  );
}
