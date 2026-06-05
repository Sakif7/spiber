"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Arrow } from "@/components/ui";

type Cat = {
  slug: string;
  name: string;
  children: { slug: string; name: string }[];
};

/**
 * Marketplace mega-menu: the category tree as a grid of top categories, each
 * with a few subcategory links. Data from /api/catalog/marketplace.
 */
export function MarketplaceMega({ onNavigate }: { onNavigate?: () => void }) {
  const locale = useLocale();
  const [cats, setCats] = useState<Cat[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/catalog/marketplace?locale=${locale}`)
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok) setCats(j.data.categories);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [locale]);

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid var(--color-hairline)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--teal-700)",
          }}
        >
          Spiber Marketplace
        </span>
        <Link
          href="/marketplace"
          onClick={onNavigate}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--color-brand-deep)",
            textDecoration: "none",
          }}
        >
          Shop all products <Arrow size={12} />
        </Link>
      </div>

      <div
        style={{
          padding: 16,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
          maxHeight: 360,
          overflowY: "auto",
        }}
      >
        {!cats &&
          Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                height: 96,
                borderRadius: 10,
                background:
                  "linear-gradient(90deg, var(--color-surface-2), var(--color-surface) 50%, var(--color-surface-2))",
                opacity: 0.7,
              }}
            />
          ))}
        {cats && cats.length === 0 && (
          <span
            style={{
              gridColumn: "1 / -1",
              padding: 12,
              fontSize: 13,
              color: "var(--color-text-muted)",
            }}
          >
            Categories coming online soon.
          </span>
        )}
        {cats?.map((c) => (
          <div key={c.slug} style={{ padding: "10px 12px" }}>
            <Link
              href={`/marketplace/category/${c.slug}`}
              onClick={onNavigate}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-display)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-text-strong)",
                textDecoration: "none",
              }}
            >
              {c.name}
            </Link>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                marginTop: 6,
              }}
            >
              {c.children.slice(0, 4).map((ch) => (
                <Link
                  key={ch.slug}
                  href={`/marketplace/category/${ch.slug}`}
                  onClick={onNavigate}
                  className="mp-sub"
                  style={{
                    padding: "5px 8px",
                    borderRadius: "var(--r-sm)",
                    fontSize: 12.5,
                    color: "var(--color-text-muted)",
                    textDecoration: "none",
                  }}
                >
                  {ch.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <style>{`.mp-sub:hover { background: var(--color-surface-2); color: var(--color-text); }`}</style>
    </div>
  );
}
