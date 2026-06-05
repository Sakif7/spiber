"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Arrow } from "@/components/ui";

type NavCat = { id: string; slug: string; name: string };
type NavBrand = { id: string; name: string };
type MiniProduct = { slug: string; name: string; image: string | null };
type Division = {
  key: string;
  kicker: string;
  title: string;
  desc: string;
  href: string;
};

const TEAL = "var(--teal-700)";

/**
 * Products & Solutions mega-menu. LEFT: the division cards (Instruments,
 * Systems) — hovering one drives the RIGHT panel. For Instruments the right
 * panel offers Category + Brand (stacked in one column); picking one replaces
 * the panel in place with that selection's products. For Systems it lists the
 * software products. Data: /api/catalog/{nav,products,systems}, cached.
 */
export function ProductsMega({
  divisions,
  onNavigate,
}: {
  divisions: Division[];
  onNavigate?: () => void;
}) {
  const locale = useLocale();
  const [active, setActive] = useState(0);
  const division = divisions[active] ?? divisions[0];
  const isSystems = division?.key === "systems";

  // Instruments browser state
  const [nav, setNav] = useState<{
    categories: NavCat[];
    brands: NavBrand[];
  } | null>(null);
  const [view, setView] = useState<"browse" | "products">("browse");
  const [selLabel, setSelLabel] = useState("");
  const [selHref, setSelHref] = useState("/instruments");
  const [products, setProducts] = useState<MiniProduct[]>([]);
  const [loadingP, setLoadingP] = useState(false);
  const cache = useRef<Map<string, MiniProduct[]>>(new Map());

  // Systems product list
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

  function pickDivision(i: number) {
    setActive(i);
    setView("browse");
  }
  function loadProducts(key: string, qs: string, label: string, href: string) {
    setSelLabel(label);
    setSelHref(href);
    setView("products");
    const cached = cache.current.get(key);
    if (cached) {
      setProducts(cached);
      return;
    }
    setLoadingP(true);
    setProducts([]);
    fetch(`/api/catalog/products?locale=${locale}&${qs}`)
      .then((r) => r.json())
      .then((j) => {
        const list: MiniProduct[] = j?.ok ? j.data.products : [];
        cache.current.set(key, list);
        setProducts(list);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingP(false));
  }

  const headerLeft =
    !isSystems && view === "products" ? (
      <button
        type="button"
        onClick={() => setView("browse")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          padding: 0,
        }}
      >
        ← Back
      </button>
    ) : (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: TEAL,
        }}
      >
        {division?.title}
      </span>
    );

  const headerHref = isSystems
    ? "/systems"
    : view === "products"
      ? selHref
      : "/instruments";
  const headerCta = isSystems
    ? "All systems"
    : view === "products"
      ? "View all"
      : "All products";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 280px) 1fr",
      }}
    >
      {/* Left: division cards drive the right panel */}
      <div
        style={{
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {divisions.map((d, i) => (
          <Link
            key={d.key}
            href={d.href}
            onMouseEnter={() => pickDivision(i)}
            onFocus={() => pickDivision(i)}
            onClick={onNavigate}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "14px 16px",
              borderRadius: "var(--r-lg)",
              textDecoration: "none",
              background: i === active ? "var(--teal-50)" : "transparent",
              transition: "background 180ms",
            }}
          >
            <span
              style={{
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
                fontSize: 12.5,
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
        ))}
      </div>

      {/* Right: panel for the active division */}
      <div
        style={{ borderLeft: "1px solid var(--color-hairline)", minWidth: 0 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--color-hairline)",
          }}
        >
          {headerLeft}
          <Link
            href={headerHref}
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
            {headerCta} <Arrow size={12} />
          </Link>
        </div>

        {isSystems ? (
          <div style={{ padding: 14 }}>
            <ProductList
              loading={systems === null}
              products={systems ?? []}
              hrefBase="/systems/product"
              onNavigate={onNavigate}
              empty="No systems products yet."
            />
          </div>
        ) : view === "browse" ? (
          <div style={{ padding: 14, maxHeight: 340, overflowY: "auto" }}>
            {!nav && <Skeleton rows={6} />}
            {nav && nav.categories.length === 0 && nav.brands.length === 0 && (
              <div
                style={{
                  padding: 12,
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                }}
              >
                Catalog coming online soon.
              </div>
            )}
            {nav && nav.categories.length > 0 && (
              <Section label="By category">
                {nav.categories.map((c) => (
                  <Row
                    key={c.id}
                    label={c.name}
                    onClick={() =>
                      loadProducts(
                        `c:${c.id}`,
                        `categoryId=${c.id}`,
                        c.name,
                        `/instruments/${c.slug}`,
                      )
                    }
                  />
                ))}
              </Section>
            )}
            {nav && nav.brands.length > 0 && (
              <Section
                label="By brand"
                style={
                  nav.categories.length > 0 ? { marginTop: 12 } : undefined
                }
              >
                {nav.brands.map((b) => (
                  <Row
                    key={b.id}
                    label={b.name}
                    onClick={() =>
                      loadProducts(
                        `b:${b.id}`,
                        `brandId=${b.id}`,
                        b.name,
                        `/instruments?brand=${b.id}`,
                      )
                    }
                  />
                ))}
              </Section>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--color-text-strong)",
              }}
            >
              {selLabel}
            </span>
            <ProductList
              loading={loadingP}
              products={products}
              hrefBase="/instruments/product"
              onNavigate={onNavigate}
              empty="No products here yet."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
          padding: "0 4px 6px",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="mega-row"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "8px 12px",
        borderRadius: "var(--r-md)",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 13,
        color: "var(--color-text)",
      }}
    >
      {label}
      <Arrow size={12} />
      <style>{`.mega-row:hover { background: var(--color-surface-2); }`}</style>
    </button>
  );
}

function ProductList({
  loading,
  products,
  hrefBase,
  onNavigate,
  empty,
}: {
  loading: boolean;
  products: MiniProduct[];
  hrefBase: string;
  onNavigate?: () => void;
  empty: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 8,
        maxHeight: 312,
        overflowY: "auto",
        paddingRight: 4,
      }}
    >
      {loading && <Skeleton rows={6} />}
      {!loading && products.length === 0 && (
        <span
          style={{
            gridColumn: "1 / -1",
            padding: 12,
            fontSize: 13,
            color: "var(--color-text-muted)",
          }}
        >
          {empty}
        </span>
      )}
      {products.map((p) => (
        <Link
          key={p.slug}
          href={`${hrefBase}/${p.slug}`}
          onClick={onNavigate}
          className="mega-prod"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 8,
            borderRadius: "var(--r-md)",
            textDecoration: "none",
            color: "var(--color-text)",
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-hairline)",
              display: "grid",
              placeItems: "center",
            }}
          >
            {p.image ? (
              <Image
                src={p.image}
                alt=""
                width={40}
                height={40}
                style={{ objectFit: "cover", width: 40, height: 40 }}
              />
            ) : (
              <span style={{ color: TEAL, fontSize: 16 }}>+</span>
            )}
          </span>
          <span
            style={{
              fontSize: 12.5,
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {p.name}
          </span>
        </Link>
      ))}
      <style>{`.mega-prod:hover { background: var(--color-surface-2); }`}</style>
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            height: 34,
            borderRadius: 8,
            background:
              "linear-gradient(90deg, var(--color-surface-2), var(--color-surface) 50%, var(--color-surface-2))",
            opacity: 0.7,
          }}
        />
      ))}
    </>
  );
}
