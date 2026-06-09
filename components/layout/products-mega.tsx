"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { Arrow } from "@/components/ui";
import { Cascade, type CascadeNode } from "@/components/layout/cascade/cascade";
import { loadCatalogProducts } from "@/components/layout/cascade/load-products";

type NavCat = {
  id: string;
  slug: string;
  name: string;
  children: { id: string; slug: string; name: string }[];
};
type NavBrand = { id: string; name: string };
type MiniProduct = { slug: string; name: string; image: string | null };
type Division = {
  key: string;
  kicker: string;
  title: string;
  desc: string;
  href: string;
};

const TEAL = "var(--teal-300)";

/**
 * Products & Solutions mega-menu — a dark 3-LEVEL cascade. The LEFT rail (the
 * Instruments / Systems division cards) drives the cascade roots; hovering a
 * top category opens its subcategories (L2), hovering a subcategory opens its
 * products (L3). Brands and empty-subtree categories cascade straight to
 * products (2 levels). Systems is a flat product grid. The engine
 * (`Cascade`) owns hover-intent + safe-triangle + keyboard.
 */
export function ProductsMega({
  divisions,
  onNavigate,
}: {
  divisions: Division[];
  onNavigate?: () => void;
}) {
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const division = divisions[active] ?? divisions[0];
  const isSystems = division?.key === "systems";

  const [nav, setNav] = useState<{
    categories: NavCat[];
    brands: NavBrand[];
  } | null>(null);
  const [systems, setSystems] = useState<MiniProduct[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/catalog/nav?locale=${locale}`)
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok) setNav(j.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [locale]);

  useEffect(() => {
    if (!isSystems || systems !== null) return;
    let alive = true;
    fetch(`/api/catalog/systems?locale=${locale}`)
      .then((r) => r.json())
      .then((j) => {
        if (alive) setSystems(j?.ok ? j.data.products : []);
      })
      .catch(() => {
        if (alive) setSystems([]);
      });
    return () => {
      alive = false;
    };
  }, [isSystems, systems, locale]);

  const roots = useMemo<CascadeNode[]>(() => {
    if (isSystems) {
      return (systems ?? []).map((p) => ({
        id: p.slug,
        label: p.name,
        kind: "product",
        href: `/digihealth/product/${p.slug}`,
        image: p.image,
      }));
    }
    if (!nav) return [];
    const catNodes: CascadeNode[] = nav.categories.map((c) => ({
      id: `c:${c.id}`,
      label: c.name,
      kind: "category",
      href: `/medtrade/${c.slug}`,
      group: "By category",
      loadChildren: () => {
        if (c.children.length) {
          return Promise.resolve(
            c.children.map((sub) => ({
              id: `s:${sub.id}`,
              label: sub.name,
              kind: "subcategory" as const,
              href: `/medtrade/${sub.slug}`,
              loadChildren: () =>
                loadCatalogProducts(
                  locale,
                  `categoryId=${sub.id}`,
                  "/medtrade/product",
                ),
            })),
          );
        }
        // No subcategories → jump straight to this category's products (2 levels).
        return loadCatalogProducts(
          locale,
          `categoryId=${c.id}`,
          "/medtrade/product",
        );
      },
    }));
    const brandNodes: CascadeNode[] = nav.brands.map((b) => ({
      id: `b:${b.id}`,
      label: b.name,
      kind: "brand",
      href: `/medtrade?brand=${b.id}`,
      group: "By brand",
      loadChildren: () =>
        loadCatalogProducts(locale, `brandId=${b.id}`, "/medtrade/product"),
    }));
    return [...catNodes, ...brandNodes];
  }, [isSystems, systems, nav, locale]);

  const loading =
    (!isSystems && nav === null) || (isSystems && systems === null);

  return (
    <div style={{ display: "flex", alignItems: "stretch", minWidth: 0 }}>
      {/* LEFT: division rail (drives the cascade roots). */}
      <div
        style={{
          flexShrink: 0,
          width: 264,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {divisions.map((d, i) => {
          const activeCard = i === active;
          return (
            <Link
              key={d.key}
              href={d.href}
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
                  layoutId={reduce ? undefined : "products-division-hl"}
                  aria-hidden
                  transition={{ type: "spring", stiffness: 440, damping: 36 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "var(--r-lg)",
                    background:
                      "linear-gradient(90deg, rgba(28,184,186,0.22), rgba(28,184,186,0) 85%)",
                    boxShadow: "inset 2px 0 0 var(--teal-300)",
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
                  color: TEAL,
                }}
              >
                {d.kicker}
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
                {d.title}
                <Arrow size={12} />
              </span>
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--color-text-muted)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {d.desc}
              </span>
            </Link>
          );
        })}
      </div>

      {/* RIGHT: the cascade. Horizontal scroll is the last-resort fallback on
          very narrow viewports (columns keep their own vertical scroll). */}
      <div
        className="mega-scroll"
        style={{
          borderLeft: "1px solid var(--color-hairline)",
          minWidth: 0,
          display: "flex",
          overflowX: "auto",
        }}
      >
        {loading ? (
          <ColumnSkeleton />
        ) : (
          <Cascade key={division?.key} roots={roots} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}

function ColumnSkeleton() {
  return (
    <div
      style={{
        width: 252,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            height: 34,
            borderRadius: 8,
            background:
              "linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12) 50%, rgba(255,255,255,.06))",
          }}
        />
      ))}
    </div>
  );
}
