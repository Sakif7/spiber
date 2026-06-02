"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { startRouteOverlay } from "@/components/layout/route-transition-overlay";

export type BrandOption = { id: string; name: string };

export function Filters({ brands }: { brands: BrandOption[] }) {
  const t = useTranslations("shop.listing");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [search, setSearch] = useState(sp.get("q") ?? "");
  const [brand, setBrand] = useState(sp.get("brand") ?? "");
  const [min, setMin] = useState(sp.get("min") ?? "");
  const [max, setMax] = useState(sp.get("max") ?? "");
  const [inStock, setInStock] = useState(sp.get("inStock") === "1");
  const [sort, setSort] = useState(sp.get("sort") ?? "newest");

  function apply() {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (brand) p.set("brand", brand);
    if (min) p.set("min", min);
    if (max) p.set("max", max);
    if (inStock) p.set("inStock", "1");
    if (sort && sort !== "newest") p.set("sort", sort);
    startRouteOverlay();
    router.push(`${pathname}?${p.toString()}`);
  }

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
      <strong style={{ fontFamily: "var(--font-display)" }}>
        {t("filters")}
      </strong>

      <div style={{ display: "grid", gap: 6 }}>
        <span style={label}>{t("search")}</span>
        <input
          style={field}
          value={search}
          placeholder={t("searchPlaceholder")}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
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
          onClick={() => {
            startRouteOverlay();
            router.push(pathname);
          }}
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
