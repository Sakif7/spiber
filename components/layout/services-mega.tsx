"use client";

import { useState } from "react";
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

/**
 * Services mega-menu: division cards on the left; hovering one changes the right
 * panel to that service's quick links (mirrors the Products menu's left+right
 * shape — services have no catalog to browse, so the right is curated links).
 */
export function ServicesMega({
  items,
  onNavigate,
}: {
  items: ServiceItem[];
  onNavigate: () => void;
}) {
  const [active, setActive] = useState(0);
  const cur = items[active] ?? items[0];
  const links = cur?.links ?? [];

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) 1fr" }}
    >
      {/* Left: service cards */}
      <div
        style={{
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {items.map((it, i) => (
          <Link
            key={it.key}
            href={it.href}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={onNavigate}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "14px 16px",
              borderRadius: "var(--r-lg)",
              textDecoration: "none",
              background: i === active ? "var(--orange-50)" : "transparent",
              transition: "background 180ms",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--orange-700)",
              }}
            >
              {it.kicker}
            </span>
            <span
              style={{
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
                fontSize: 12.5,
                lineHeight: 1.5,
                color: "var(--color-text-muted)",
              }}
            >
              {it.desc}
            </span>
          </Link>
        ))}
      </div>

      {/* Right: quick links for the active service */}
      <div
        style={{
          padding: 18,
          borderLeft: "1px solid var(--color-hairline)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--orange-700)",
          }}
        >
          {cur?.title}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {links.map((l) => (
            <Link
              key={l.href + l.label}
              href={l.href}
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
        <style>{`.svc-link:hover { background: var(--color-surface-2); }`}</style>
      </div>
    </div>
  );
}
