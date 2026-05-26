"use client";

import { CSSProperties, ReactNode, useId } from "react";

export type Tone = "teal" | "orange" | "slate" | "dark";

/**
 * Placeholder — striped SVG with a mono label, used wherever a real image
 * (product shot, portrait, etc.) hasn't been supplied yet.
 *
 * The pattern's fragment-identifier id comes from `useId()` so it stays
 * stable across SSR and client hydration.
 */
export function Placeholder({
  label,
  tone = "teal",
  style,
  className,
  children,
}: {
  label: string;
  tone?: Tone;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}) {
  const rawId = useId();
  const id = "ph" + rawId.replace(/[^a-z0-9]/gi, "");

  const bg =
    tone === "teal"
      ? "linear-gradient(135deg, var(--teal-50), var(--teal-100))"
      : tone === "orange"
      ? "linear-gradient(135deg, var(--orange-50), var(--orange-100))"
      : tone === "slate"
      ? "linear-gradient(135deg, var(--slate-100), var(--slate-200))"
      : tone === "dark"
      ? "linear-gradient(135deg, var(--slate-800), var(--slate-900))"
      : "var(--color-surface-2)";
  const stroke =
    tone === "teal"
      ? "rgba(14,139,134,.18)"
      : tone === "orange"
      ? "rgba(230,107,38,.18)"
      : tone === "slate"
      ? "rgba(10,19,24,.08)"
      : tone === "dark"
      ? "rgba(255,255,255,.08)"
      : "rgba(10,19,24,.08)";
  const txt =
    tone === "dark"
      ? "rgba(255,255,255,.85)"
      : tone === "orange"
      ? "var(--orange-700)"
      : tone === "teal"
      ? "var(--teal-700)"
      : "var(--slate-700)";

  return (
    <div
      className={className}
      style={{ position: "relative", overflow: "hidden", background: bg, ...style }}
    >
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern
            id={id}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="10" stroke={stroke} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
      {label && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: txt,
              background: tone === "dark" ? "rgba(10,19,24,.6)" : "rgba(255,255,255,.78)",
              padding: "5px 9px",
              borderRadius: 4,
              backdropFilter: "blur(4px)",
            }}
          >
            ↓ {label}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
