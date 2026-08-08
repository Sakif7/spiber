"use client";

import {
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Minus, Plus, Star } from "lucide-react";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { DualRange } from "@/components/ui/dual-range";

export type BrandOption = { id: string; name: string };
export type CategoryNavItem = { slug: string; name: string; count?: number };

/** Serializable facet data computed server-side (see getProductFacets). */
export type FilterFacets = {
  brandCounts: Record<string, number>;
  categoryCounts?: Record<string, number>;
  priceMinMinor: number | null;
  priceMaxMinor: number | null;
  inStockCount: number;
  onSaleCount: number;
  ratingCounts: { r2: number; r3: number; r4: number };
};

const BRAND_PREVIEW = 8;

/**
 * Faceted filter sidebar — fully LIVE: every control applies itself (debounced
 * where the input is continuous), so there is no Apply/Submit button and no
 * full-page transition veil. Navigation is router.replace inside a transition:
 * the grid re-renders in place, scroll and focus stay put.
 *
 * URL is the source of truth (`brand` is a comma list for multi-select); local
 * state mirrors it for instant control feedback and resyncs whenever the URL
 * changes underneath us (chip removal, Reset, back/forward).
 */
export function Filters({
  brands,
  showRating = false,
  showDeals = false,
  categories,
  currentSlug,
  categoryBasePath = "/medtrade",
  categoryLinkPrefix,
  categoryMode = "links",
  facets,
}: {
  brands: BrandOption[];
  showRating?: boolean;
  /** Offer a "On sale" facet (marketplace — needs compare-at prices). */
  showDeals?: boolean;
  /** When provided, renders a category nav at the top of the sidebar. */
  categories?: CategoryNavItem[];
  currentSlug?: string;
  /** Href for the "All categories" link. */
  categoryBasePath?: string;
  /** Prefix for each category link (`${prefix}/${slug}`). Defaults to base. */
  categoryLinkPrefix?: string;
  /**
   * How the category rows behave. "filter" (the all-products surfaces):
   * selecting one applies `?category=` IN PLACE like every other facet — no
   * navigation, no scroll jump. "links" (dedicated category pages): real
   * navigation to the category page, landing at the product grid (#listing).
   */
  categoryMode?: "links" | "filter";
  /** Per-facet result counts + price bounds; sections degrade without it. */
  facets?: FilterFacets;
}) {
  const t = useTranslations("shop.listing");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Mobile: the sidebar stacks above the grid; collapse it behind a toggle
  // (default closed) so products are visible immediately. Desktop ignores this.
  const [open, setOpen] = useState(false);

  // ---- Local mirrors of the URL state ----
  const [selectedBrands, setSelectedBrands] = useState<string[]>(() =>
    (sp.get("brand") ?? "").split(",").filter(Boolean),
  );
  const [category, setCategory] = useState(sp.get("category") ?? "");
  const [min, setMin] = useState(sp.get("min") ?? "");
  const [max, setMax] = useState(sp.get("max") ?? "");
  const [inStock, setInStock] = useState(sp.get("inStock") === "1");
  const [deal, setDeal] = useState(sp.get("deal") === "1");
  const [rating, setRating] = useState(sp.get("rating") ?? "");
  const [brandsExpanded, setBrandsExpanded] = useState(false);

  // Resync from the URL when it changes underneath us (chips, Reset link,
  // back/forward). React's adjust-state-during-render pattern — our own
  // pushes make the URL match local state, so those resyncs are no-ops.
  const spString = sp.toString();
  const [lastSp, setLastSp] = useState(spString);
  if (lastSp !== spString) {
    setLastSp(spString);
    setSelectedBrands((sp.get("brand") ?? "").split(",").filter(Boolean));
    setCategory(sp.get("category") ?? "");
    setMin(sp.get("min") ?? "");
    setMax(sp.get("max") ?? "");
    setInStock(sp.get("inStock") === "1");
    setDeal(sp.get("deal") === "1");
    setRating(sp.get("rating") ?? "");
  }

  // ---- Live apply ----
  type Overrides = {
    brands?: string[];
    category?: string;
    min?: string;
    max?: string;
    inStock?: boolean;
    deal?: boolean;
    rating?: string;
  };

  /** Push the given state to the URL (replace, in a transition — no veil, no
   * scroll jump, no history spam). `page` resets; `q` and `sort` ride along. */
  function apply(over: Overrides = {}) {
    const p = new URLSearchParams();
    const q = sp.get("q");
    const sort = sp.get("sort");
    if (q) p.set("q", q);
    if (categoryMode === "filter") {
      const c = over.category ?? category;
      if (c) p.set("category", c);
    }
    const b = over.brands ?? selectedBrands;
    if (b.length) p.set("brand", b.join(","));
    const mn = over.min ?? min;
    const mx = over.max ?? max;
    if (mn) p.set("min", mn);
    if (mx) p.set("max", mx);
    if (over.inStock ?? inStock) p.set("inStock", "1");
    if (showDeals && (over.deal ?? deal)) p.set("deal", "1");
    const r = over.rating ?? rating;
    if (showRating && r) p.set("rating", r);
    if (sort && sort !== "newest") p.set("sort", sort);

    const canon = (s: string) => {
      const u = new URLSearchParams(s);
      u.delete("page");
      u.sort();
      return u.toString();
    };
    if (canon(p.toString()) === canon(sp.toString())) return;
    const url = p.toString() ? `${pathname}?${p.toString()}` : pathname;
    startTransition(() => router.replace(url, { scroll: false }));
  }

  const debouncedApply = useDebouncedCallback(() => apply(), 600);

  function reset() {
    setSelectedBrands([]);
    setCategory("");
    setMin("");
    setMax("");
    setInStock(false);
    setDeal(false);
    setRating("");
    debouncedApply.cancel();
    apply({
      brands: [],
      category: "",
      min: "",
      max: "",
      inStock: false,
      deal: false,
      rating: "",
    });
  }

  const activeCount =
    selectedBrands.length +
    (categoryMode === "filter" && category ? 1 : 0) +
    (min || max ? 1 : 0) +
    (inStock ? 1 : 0) +
    (deal ? 1 : 0) +
    (rating ? 1 : 0);

  // ---- Price slider bounds (taka), derived from the facet price range ----
  const bounds = useMemo(() => {
    if (facets?.priceMinMinor == null || facets?.priceMaxMinor == null)
      return null;
    const loT = Math.floor(facets.priceMinMinor / 100);
    const hiT = Math.ceil(facets.priceMaxMinor / 100);
    if (hiT <= loT) return null;
    // A step that gives ~100 positions, rounded to a friendly unit.
    const raw = (hiT - loT) / 100;
    const pow = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw))));
    const step = Math.max(1, Math.ceil(raw / pow) * pow);
    return { lo: loT, hi: hiT, step };
  }, [facets?.priceMinMinor, facets?.priceMaxMinor]);

  const sliderLo = min !== "" ? Number(min) : (bounds?.lo ?? 0);
  const sliderHi = max !== "" ? Number(max) : (bounds?.hi ?? 0);

  // No priced products in scope (e.g. Medtrade is price-on-request) → a price
  // filter is meaningless; hide the section unless a stale min/max needs
  // clearing. Without facet data we can't know, so keep it.
  const showPrice = !facets || bounds !== null || min !== "" || max !== "";

  // With facet data, only offer brands that can actually narrow THIS result
  // set (count > 0) — a wall of zero-count brands is noise. Selected brands
  // always stay visible so they can be unchecked.
  const offerableBrands = facets
    ? brands.filter(
        (b) =>
          (facets.brandCounts[b.id] ?? 0) > 0 || selectedBrands.includes(b.id),
      )
    : brands;
  const visibleBrands = brandsExpanded
    ? offerableBrands
    : offerableBrands.slice(0, BRAND_PREVIEW);

  return (
    <aside className="filters-aside" style={asideStyle}>
      {/* Mobile-only collapse toggle (hidden ≥980 via CSS) */}
      <button
        type="button"
        className="filters-toggle"
        aria-expanded={open}
        aria-controls="filters-body"
        onClick={() => setOpen((o) => !o)}
      >
        {t("filters")}
        {activeCount > 0 && <span style={countBubble}>{activeCount}</span>}
        <span className="nav-chevron" data-open={open} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <div
        id="filters-body"
        className="filters-body"
        data-open={open ? "true" : "false"}
        style={{ display: "flex", flexDirection: "column" }}
        aria-busy={isPending}
      >
        {/* Header bar — title + Reset (reference: "Filter By | Reset") */}
        <div style={headerBar}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {t("filterBy")}
            {isPending && <span style={spinner} aria-hidden />}
          </span>
          <button
            type="button"
            onClick={reset}
            disabled={activeCount === 0}
            style={{
              background: "none",
              border: 0,
              color: "#fff",
              opacity: activeCount === 0 ? 0.55 : 1,
              cursor: activeCount === 0 ? "default" : "pointer",
              font: "inherit",
              fontSize: "var(--fs-body-sm)",
              fontWeight: 600,
              textDecoration: activeCount === 0 ? "none" : "underline",
              textUnderlineOffset: 3,
            }}
          >
            {t("reset")}
          </button>
        </div>

        {categories && categories.length > 0 && (
          <Section title={t("categories")} defaultOpen>
            {categoryMode === "filter" ? (
              // A facet like any other: selecting applies IN PLACE (no
              // navigation, no scroll-to-top); clicking again deselects.
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr)",
                  gap: 2,
                }}
              >
                <CategoryRow
                  label={t("allCategories")}
                  active={!category}
                  onSelect={() => {
                    setCategory("");
                    debouncedApply.cancel();
                    apply({ category: "" });
                  }}
                />
                {categories.map((c) => (
                  <CategoryRow
                    key={c.slug}
                    label={c.name}
                    count={c.count}
                    active={category === c.slug}
                    onSelect={() => {
                      const next = category === c.slug ? "" : c.slug;
                      setCategory(next);
                      debouncedApply.cancel();
                      apply({ category: next });
                    }}
                  />
                ))}
              </div>
            ) : (
              // Dedicated category pages: real navigation, but land on the
              // product grid (#listing) instead of the hero — and no veil.
              <nav
                aria-label={t("categories")}
                style={{ display: "grid", gap: 2 }}
              >
                <Link
                  href={categoryBasePath}
                  style={catLinkStyle(!currentSlug)}
                >
                  {t("allCategories")}
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`${categoryLinkPrefix ?? categoryBasePath}/${c.slug}#listing`}
                    style={catLinkStyle(currentSlug === c.slug)}
                  >
                    {c.name}
                  </Link>
                ))}
              </nav>
            )}
          </Section>
        )}

        {/* Price — inputs + dual slider, live (debounced / applied on release) */}
        {showPrice && (
          <Section title={t("price")} defaultOpen>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  style={field}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder={bounds ? String(bounds.lo) : t("min")}
                  aria-label={t("min")}
                  value={min}
                  onChange={(e) => {
                    setMin(e.target.value);
                    debouncedApply();
                  }}
                />
                <span aria-hidden style={{ color: "var(--color-text-subtle)" }}>
                  –
                </span>
                <input
                  style={field}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder={bounds ? String(bounds.hi) : t("max")}
                  aria-label={t("max")}
                  value={max}
                  onChange={(e) => {
                    setMax(e.target.value);
                    debouncedApply();
                  }}
                />
              </div>
              {bounds && (
                <DualRange
                  min={bounds.lo}
                  max={bounds.hi}
                  step={bounds.step}
                  valueMin={sliderLo}
                  valueMax={sliderHi}
                  ariaLabelMin={t("min")}
                  ariaLabelMax={t("max")}
                  onChange={(lo, hi) => {
                    debouncedApply.cancel();
                    setMin(lo <= bounds.lo ? "" : String(lo));
                    setMax(hi >= bounds.hi ? "" : String(hi));
                  }}
                  onCommit={(lo, hi) => {
                    debouncedApply.cancel();
                    apply({
                      min: lo <= bounds.lo ? "" : String(lo),
                      max: hi >= bounds.hi ? "" : String(hi),
                    });
                  }}
                />
              )}
            </div>
          </Section>
        )}

        {/* Availability */}
        <Section title={t("availability")} defaultOpen>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 8,
            }}
          >
            <FacetCheckbox
              label={t("excludeOutOfStock")}
              checked={inStock}
              count={facets?.inStockCount}
              onToggle={() => {
                const next = !inStock;
                setInStock(next);
                debouncedApply.cancel();
                apply({ inStock: next });
              }}
            />
            {showDeals && (
              <FacetCheckbox
                label={t("onSaleOnly")}
                checked={deal}
                count={facets?.onSaleCount}
                onToggle={() => {
                  const next = !deal;
                  setDeal(next);
                  debouncedApply.cancel();
                  apply({ deal: next });
                }}
              />
            )}
          </div>
        </Section>

        {/* Brand — multi-select checkboxes with counts */}
        {offerableBrands.length > 0 && (
          <Section
            title={t("brand")}
            defaultOpen={offerableBrands.length <= BRAND_PREVIEW}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr)",
                gap: 8,
                maxHeight: brandsExpanded ? 320 : undefined,
                overflowY: brandsExpanded ? "auto" : undefined,
                paddingRight: brandsExpanded ? 4 : undefined,
              }}
            >
              {visibleBrands.map((b) => {
                const checked = selectedBrands.includes(b.id);
                const count = facets?.brandCounts[b.id] ?? 0;
                return (
                  <FacetCheckbox
                    key={b.id}
                    label={b.name}
                    checked={checked}
                    count={facets ? count : undefined}
                    dim={facets ? count === 0 && !checked : false}
                    onToggle={() => {
                      const next = checked
                        ? selectedBrands.filter((id) => id !== b.id)
                        : [...selectedBrands, b.id];
                      setSelectedBrands(next);
                      debouncedApply.cancel();
                      apply({ brands: next });
                    }}
                  />
                );
              })}
            </div>
            {offerableBrands.length > BRAND_PREVIEW && (
              <button
                type="button"
                onClick={() => setBrandsExpanded((v) => !v)}
                style={showMoreBtn}
              >
                {brandsExpanded
                  ? t("showLess")
                  : t("showAllBrands", { count: offerableBrands.length })}
              </button>
            )}
          </Section>
        )}

        {/* Rating — "N stars & up", single select */}
        {showRating && (
          <Section title={t("rating")} defaultOpen>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr)",
                gap: 8,
              }}
            >
              {([4, 3, 2] as const).map((n) => {
                const key = String(n);
                const checked = rating === key;
                const count =
                  facets?.ratingCounts[`r${n}` as "r2" | "r3" | "r4"];
                return (
                  <FacetCheckbox
                    key={n}
                    checked={checked}
                    count={count}
                    label={
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          aria-hidden
                          style={{ display: "inline-flex", gap: 1 }}
                        >
                          {Array.from({ length: n }).map((_, i) => (
                            <Star
                              key={i}
                              size={12}
                              fill="var(--color-secondary)"
                              color="var(--color-secondary)"
                            />
                          ))}
                        </span>
                        {t("starsAndUp", { n })}
                      </span>
                    }
                    onToggle={() => {
                      const next = checked ? "" : key;
                      setRating(next);
                      debouncedApply.cancel();
                      apply({ rating: next });
                    }}
                  />
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </aside>
  );
}

/** Collapsible sidebar section — title row with a −/+ indicator. */
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{ borderTop: "1px solid var(--color-hairline)" }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={sectionHead}
      >
        <span
          style={{
            fontWeight: 600,
            color: "var(--color-text-strong)",
            fontSize: "var(--fs-body-sm)",
          }}
        >
          {title}
        </span>
        {open ? (
          <Minus size={15} color="var(--color-text-muted)" aria-hidden />
        ) : (
          <Plus size={15} color="var(--color-text-muted)" aria-hidden />
        )}
      </button>
      {/* 0fr→1fr grid transition: animated collapse without measuring. The
          child needs min-height:0 or its min-content size defeats the 0fr. */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 220ms ease",
        }}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ padding: "2px 14px 14px" }}>{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Category facet row (filter mode): radio-style select with a count pill. */
function CategoryRow({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count?: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        minWidth: 0,
        maxWidth: "100%",
        padding: "7px 12px",
        border: 0,
        borderRadius: "var(--r-md)",
        background: active ? "var(--color-brand-soft)" : "transparent",
        color: active ? "var(--color-brand-deep)" : "var(--color-text)",
        fontWeight: active ? 600 : 400,
        fontSize: "var(--fs-body-sm)",
        fontFamily: "inherit",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {count != null && (
        <span style={countPill} aria-label={`(${count})`}>
          {count}
        </span>
      )}
    </button>
  );
}

/** One facet row: checkbox + label left, count pill right (reference style). */
function FacetCheckbox({
  label,
  checked,
  count,
  dim = false,
  onToggle,
}: {
  label: ReactNode;
  checked: boolean;
  count?: number;
  dim?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        // Grid/flex children default to min-width:auto — without these the
        // nowrap label text forces the row past the sidebar and clips the
        // count pill at the aside's overflow edge.
        minWidth: 0,
        maxWidth: "100%",
        cursor: "pointer",
        fontSize: "var(--fs-body-sm)",
        color: dim ? "var(--color-text-subtle)" : "var(--color-text)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          style={{ accentColor: "var(--color-brand)", flexShrink: 0 }}
        />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </span>
      {count != null && (
        <span style={countPill} aria-label={`(${count})`}>
          {count}
        </span>
      )}
    </label>
  );
}

// ---- styles ----
const asideStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  height: "fit-content",
  overflow: "hidden",
};

const headerBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "12px 14px",
  background: "var(--color-brand)",
  color: "#fff",
};

const sectionHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  width: "100%",
  padding: "12px 14px",
  background: "none",
  border: 0,
  cursor: "pointer",
  font: "inherit",
  textAlign: "left",
};

const field: CSSProperties = {
  height: 38,
  padding: "0 10px",
  border: "1px solid var(--color-border-field)",
  borderRadius: "var(--r-sm)",
  font: "inherit",
  width: "100%",
  minWidth: 0,
  background: "var(--color-surface)",
};

const countPill: CSSProperties = {
  flexShrink: 0,
  minWidth: 28,
  textAlign: "center",
  padding: "1px 8px",
  borderRadius: "var(--r-pill)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-2)",
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-caption)",
  fontVariantNumeric: "tabular-nums",
};

const countBubble: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  minWidth: 20,
  height: 20,
  padding: "0 5px",
  marginLeft: 8,
  borderRadius: 999,
  background: "var(--color-brand)",
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
};

const spinner: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,.4)",
  borderTopColor: "#fff",
  // Reuses the route-overlay spinner keyframe already in globals.css.
  animation: "spinnerRotate .7s linear infinite",
};

const showMoreBtn: CSSProperties = {
  marginTop: 10,
  background: "none",
  border: 0,
  padding: 0,
  color: "var(--color-brand-deep)",
  fontWeight: 600,
  fontSize: "var(--fs-body-sm)",
  cursor: "pointer",
  font: "inherit",
  textAlign: "left",
};

const catLinkStyle = (active: boolean): CSSProperties => ({
  padding: "7px 12px",
  borderRadius: "var(--r-md)",
  fontSize: "var(--fs-body-sm)",
  fontWeight: active ? 600 : 400,
  textDecoration: "none",
  color: active ? "var(--color-brand-deep)" : "var(--color-text)",
  background: active ? "var(--color-brand-soft)" : "transparent",
});
