"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { startRouteOverlay } from "@/components/layout/route-transition-overlay";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";

export function CourseFilters() {
  const t = useTranslations("academy.filters");
  const lv = useTranslations("academy.levels");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [search, setSearch] = useState(sp.get("q") ?? "");
  const [level, setLevel] = useState(sp.get("level") ?? "");
  const [min, setMin] = useState(sp.get("min") ?? "");
  const [max, setMax] = useState(sp.get("max") ?? "");
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
    if (level) p.set("level", level);
    if (min) p.set("min", min);
    if (max) p.set("max", max);
    if (sort && sort !== "newest") p.set("sort", sort);
    return p.toString();
  }

  function apply() {
    navIfChanged(buildParams());
  }

  // Live search: apply after a pause without the full-page overlay (replace, so
  // keystrokes don't stack up in browser history).
  const debouncedSearch = useDebouncedCallback(
    () => navIfChanged(buildParams(), { overlay: false, replace: true }),
    350,
  );

  const field: React.CSSProperties = {
    height: 40,
    padding: "0 10px",
    border: "1px solid var(--color-border-field)",
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
        <span style={label}>{t("level")}</span>
        <select
          style={field}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="">{t("allLevels")}</option>
          <option value="beginner">{lv("beginner")}</option>
          <option value="intermediate">{lv("intermediate")}</option>
          <option value="advanced">{lv("advanced")}</option>
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

      <div style={{ display: "grid", gap: 6 }}>
        <span style={label}>{t("sort")}</span>
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
            background: "var(--color-secondary)",
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
