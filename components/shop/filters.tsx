"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { startRouteOverlay } from "@/components/layout/route-transition-overlay";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";

export type BrandOption = { id: string; name: string };
export type CategoryNavItem = { slug: string; name: string };

export function Filters({
  brands,
  showRating = false,
  categories,
  currentSlug,
  categoryBasePath = "/medtrade",
  categoryLinkPrefix,
}: {
  brands: BrandOption[];
  showRating?: boolean;
  /** When provided, renders a category nav at the top of the sidebar. */
  categories?: CategoryNavItem[];
  currentSlug?: string;
  /** Href for the "All categories" link. */
  categoryBasePath?: string;
  /** Prefix for each category link (`${prefix}/${slug}`). Defaults to base. */
  categoryLinkPrefix?: string;
}) {
  const t = useTranslations("shop.listing");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [search, setSearch] = useState(sp.get("q") ?? "");
  const [brand, setBrand] = useState(sp.get("brand") ?? "");
  const [min, setMin] = useState(sp.get("min") ?? "");
  const [max, setMax] = useState(sp.get("max") ?? "");
  const [inStock, setInStock] = useState(sp.get("inStock") === "1");
  const [rating, setRating] = useState(sp.get("rating") ?? "");
  const [sort, setSort] = useState(sp.get("sort") ?? "newest");

  // Navigate only when the target URL actually differs from the current one. A
  // no-op push never commits, which would otherwise strand the route overlay.
  function navIfChanged(
    targetSearch: string,
    opts: { overlay?: boolean; replace?: boolean } = {},
  ) {
    const { overlay = true, replace = false } = opts;
    const canon = (s: string) => {
      const u = new URLSearchParams(s);
      u.sort();
      return u.toString();
    };
    if (canon(targetSearch) === canon(sp.toString())) return;
    if (overlay) startRouteOverlay();
    const url = targetSearch ? `${pathname}?${targetSearch}` : pathname;
    if (replace) router.replace(url);
    else router.push(url);
  }

  // Build the query string from the current control state.
  function buildParams() {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (brand) p.set("brand", brand);
    if (min) p.set("min", min);
    if (max) p.set("max", max);
    if (inStock) p.set("inStock", "1");
    if (showRating && rating) p.set("rating", rating);
    if (sort && sort !== "newest") p.set("sort", sort);
    return p.toString();
  }

  function apply() {
    navIfChanged(buildParams());
  }

  // Live search: as the user types, apply after a pause without the full-page
  // overlay (replace, so keystrokes don't stack up in browser history).
  const debouncedSearch = useDebouncedCallback(
    () => navIfChanged(buildParams(), { overlay: false, replace: true }),
    350,
  );

  const field: React.CSSProperties = {
    height: 40,
    padding: "0 10px",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--r-sm)",
    font: "inherit",
    width: "100%",
    background: "var(--color-surface)",
  };
  const label: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--fs-caption)",
    textTransform: "uppercase",
    letterSpacing: "var(--tracking-eyebrow)",
    color: "var(--color-text-muted)",
  };
  const catLinkStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 12px",
    borderRadius: "var(--r-md)",
    fontSize: "var(--fs-body-sm)",
    fontWeight: active ? 600 : 400,
    textDecoration: "none",
    color: active ? "var(--color-brand-deep)" : "var(--color-text)",
    background: active ? "var(--color-brand-soft)" : "transparent",
  });

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-5)",
        padding: "var(--s-5)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-lg)",
        background: "var(--color-surface)",
        height: "fit-content",
      }}
    >
      {categories && categories.length > 0 && (
        <nav
          aria-label="Categories"
          style={{
            display: "grid",
            gap: 2,
            paddingBottom: "var(--s-4)",
            borderBottom: "1px solid var(--color-hairline)",
          }}
        >
          <span style={{ ...label, marginBottom: 6 }}>{t("categories")}</span>
          <Link
            href={categoryBasePath}
            onClick={() => startRouteOverlay()}
            style={catLinkStyle(!currentSlug)}
          >
            {t("allCategories")}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`${categoryLinkPrefix ?? categoryBasePath}/${c.slug}`}
              onClick={() => startRouteOverlay()}
              style={catLinkStyle(currentSlug === c.slug)}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      <strong style={{ fontFamily: "var(--font-display)" }}>
        {t("filters")}
      </strong>

      <div style={{ display: "grid", gap: 6 }}>
        <span style={label}>{t("search")}</span>
        <input
          style={field}
          type="search"
          value={search}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          onChange={(e) => {
            setSearch(e.target.value);
            debouncedSearch();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              debouncedSearch.cancel();
              apply();
            }
          }}
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <span style={label}>{t("brand")}</span>
        <select
          style={field}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        >
          <option value="">{t("allBrands")}</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <span style={label}>{t("price")}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={field}
            type="number"
            placeholder={t("min")}
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
          <input
            style={field}
            type="number"
            placeholder={t("max")}
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </div>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: "var(--fs-body-sm)",
        }}
      >
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => setInStock(e.target.checked)}
        />
        {t("inStockOnly")}
      </label>

      {showRating && (
        <div style={{ display: "grid", gap: 6 }}>
          <span style={label}>{t("rating")}</span>
          <select
            style={field}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            <option value="">{t("anyRating")}</option>
            <option value="4">{t("starsAndUp", { n: 4 })}</option>
            <option value="3">{t("starsAndUp", { n: 3 })}</option>
            <option value="2">{t("starsAndUp", { n: 2 })}</option>
          </select>
        </div>
      )}

      <div style={{ display: "grid", gap: 6 }}>
        <span style={label}>{t("sortBy")}</span>
        <select
          style={field}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">{t("sortNewest")}</option>
          <option value="price_asc">{t("sortPriceAsc")}</option>
          <option value="price_desc">{t("sortPriceDesc")}</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={apply}
          style={{
            flex: 1,
            height: 40,
            borderRadius: "var(--r-pill)",
            background: "var(--color-brand)",
            color: "#fff",
            border: 0,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {t("apply")}
        </button>
        <button
          type="button"
          onClick={() => navIfChanged("")}
          style={{
            height: 40,
            padding: "0 14px",
            borderRadius: "var(--r-pill)",
            background: "transparent",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
            cursor: "pointer",
          }}
        >
          {t("clear")}
        </button>
      </div>
    </aside>
  );
}
