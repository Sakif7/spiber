"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { Arrow } from "@/components/ui";

type ServiceItem = {
  key: string;
  kicker: string;
  title: string;
  desc: string;
  href: string;
  links?: { label: string; href: string }[];
};

const ORANGE = "var(--orange-400)"; // orange-700 dies on black; 400 is ~6.3:1 on the dark panel

/**
 * Services mega-menu (dark): service cards on the LEFT; hovering one changes the
 * RIGHT panel to that service's quick links. Two-level (no deeper cascade) —
 * services have no catalog to browse. Orange is the Services-only signature
 * accent (kept sparing: kicker labels + the active card wash).
 */
export function ServicesMega({
  items,
  onNavigate,
}: {
  items: ServiceItem[];
  onNavigate: () => void;
}) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const cur = items[active] ?? items[0];
  const links = cur?.links ?? [];

  return (
    <div style={{ display: "flex", alignItems: "stretch" }}>
      {/* Left: service cards */}
      <div
        style={{
          width: 300,
          flexShrink: 0,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {items.map((it, i) => {
          const activeCard = i === active;
          return (
            <Link
              key={it.key}
              href={it.href}
              role="menuitem"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={onNavigate}
              className="mega-card"
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "13px 14px",
                borderRadius: "var(--r-lg)",
                textDecoration: "none",
                background: "transparent",
              }}
            >
              {activeCard && (
                <motion.span
                  layoutId={reduce ? undefined : "services-card-hl"}
                  aria-hidden
                  transition={{ type: "spring", stiffness: 440, damping: 36 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "var(--r-lg)",
                    background:
                      "linear-gradient(90deg, rgba(236,125,63,0.22), rgba(236,125,63,0) 85%)",
                    zIndex: 0,
                  }}
                />
              )}
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: ORANGE,
                }}
              >
                {it.kicker}
              </span>
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--color-text-strong)",
                }}
              >
                {it.title}
                <Arrow size={12} />
              </span>
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--color-text-muted)",
                }}
              >
                {it.desc}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Right: quick links for the active service */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          padding: 16,
          borderLeft: "1px solid var(--color-hairline)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: ORANGE,
          }}
        >
          {cur?.title}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {links.map((l) => (
            <Link
              key={l.href + l.label}
              href={l.href}
              role="menuitem"
              onClick={onNavigate}
              className="svc-link"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "11px 12px",
                borderRadius: "var(--r-md)",
                textDecoration: "none",
                color: "var(--color-text)",
                fontSize: 13.5,
                fontWeight: 500,
              }}
            >
              {l.label}
              <Arrow size={12} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
