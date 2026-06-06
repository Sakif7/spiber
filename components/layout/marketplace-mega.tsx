"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Cascade, type CascadeNode } from "@/components/layout/cascade/cascade";
import { loadCatalogProducts } from "@/components/layout/cascade/load-products";

type Sub = { id: string; slug: string; name: string };
type Cat = { id: string; slug: string; name: string; children: Sub[] };

/**
 * Marketplace mega-menu — a single-column cascade following the same rules as
 * the others: column 1 = top categories, hovering one opens its subcategories
 * (L2), hovering a subcategory opens its products (L3). Top categories with no
 * subcategories cascade straight to products (2 levels). No division rail.
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
      .catch(() => {
        if (alive) setCats([]);
      });
    return () => {
      alive = false;
    };
  }, [locale]);

  const roots = useMemo<CascadeNode[]>(() => {
    if (!cats) return [];
    const catNodes: CascadeNode[] = cats.map((c) => ({
      id: `c:${c.id}`,
      label: c.name,
      kind: "category",
      href: `/marketplace/category/${c.slug}`,
      loadChildren: () => {
        if (c.children.length) {
          return Promise.resolve(
            c.children.map((sub) => ({
              id: `s:${sub.id}`,
              label: sub.name,
              kind: "subcategory" as const,
              href: `/marketplace/category/${sub.slug}`,
              loadChildren: () =>
                loadCatalogProducts(
                  locale,
                  `storefront=marketplace&categoryId=${sub.id}`,
                  "/marketplace/product",
                ),
            })),
          );
        }
        return loadCatalogProducts(
          locale,
          `storefront=marketplace&categoryId=${c.id}`,
          "/marketplace/product",
        );
      },
    }));
    return [
      {
        id: "all",
        label: "Shop all products",
        kind: "link",
        href: "/marketplace",
      },
      ...catNodes,
    ];
  }, [cats, locale]);

  return (
    <div
      className="mega-scroll"
      style={{ display: "flex", minWidth: 0, overflowX: "auto" }}
    >
      {cats === null ? (
        <ColumnSkeleton />
      ) : (
        <Cascade roots={roots} onNavigate={onNavigate} />
      )}
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
      {Array.from({ length: 7 }).map((_, i) => (
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
