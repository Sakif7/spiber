"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";

type CompanyItem = {
  key: string;
  title: string;
  href: string;
};

/**
 * Company mega-menu — a plain single-column list, styled identically to the
 * Marketplace cascade's first column: `.mega-row` rows (label only, no icons,
 * no descriptions) with the sliding teal selection highlight. Every item is a
 * leaf link, so there are no sub-columns.
 */
export function CompanyMega({
  items,
  onNavigate,
}: {
  items: CompanyItem[];
  onNavigate: () => void;
}) {
  const reduce = useReducedMotion();
  const [hov, setHov] = useState<number | null>(null);

  return (
    <div
      className="mega-col mega-scroll"
      style={{
        padding: 12,
        minWidth: 236,
        maxWidth: 300,
        maxHeight: "min(64vh, 420px)",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map((it, idx) => (
          <Link
            key={it.key}
            href={it.href}
            role="menuitem"
            className="mega-row"
            onMouseEnter={() => setHov(idx)}
            onMouseLeave={() => setHov(null)}
            onFocus={() => setHov(idx)}
            onClick={onNavigate}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              width: "100%",
              padding: "9px 12px",
              borderRadius: "var(--r-md)",
              fontSize: 13,
              lineHeight: 1.3,
              textDecoration: "none",
              color:
                hov === idx ? "var(--color-text-strong)" : "var(--color-text)",
              transition: "color 160ms",
            }}
          >
            {hov === idx && (
              <motion.span
                layoutId={reduce ? undefined : "mega-hl-company"}
                aria-hidden
                transition={{ type: "spring", stiffness: 440, damping: 36 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "var(--r-md)",
                  background:
                    "linear-gradient(90deg, rgba(28,184,186,0.20), rgba(28,184,186,0) 86%)",
                  boxShadow: "inset 2px 0 0 var(--teal-300)",
                  zIndex: 0,
                }}
              />
            )}
            <span style={{ position: "relative", zIndex: 1 }}>{it.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
