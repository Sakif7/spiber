import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LiveSearch } from "@/components/ui/live-search";
import { Filters, type FilterFacets } from "@/components/shop/filters";
import { SortSelect } from "@/components/shop/sort-select";
import { ViewToggle } from "@/components/shop/view-toggle";
import { ListingGrid, ListingRows } from "@/components/shop/listing-grid";
import { ProductCard } from "@/components/shop/product-card";
import { ProductListRow } from "@/components/shop/product-list-row";
import type { Lean } from "@/lib/models/_shared";
import type { IProduct } from "@/lib/models/product";
import type { Locale } from "@/i18n/routing";

type SP = Record<string, string | undefined>;
type Result = {
  items: Lean<IProduct>[];
  total: number;
  page: number;
  pages: number;
};

/** Shared faceted listing layout for marketplace shop + category pages. */
export async function MarketplaceProductListing({
  locale,
  basePath,
  sp,
  result,
  brands,
  facets,
  wishlistedIds = [],
  brandNameById = {},
  categoryNameById = {},
  subcategories = [],
  categories = [],
  currentSlug,
  categoryMode = "links",
}: {
  locale: Locale;
  basePath: string;
  sp: SP;
  result: Result;
  brands: { id: string; name: string }[];
  facets?: FilterFacets;
  wishlistedIds?: string[];
  brandNameById?: Record<string, string>;
  // CATEGORY eyebrow data (productId-category map); harmless if omitted.
  categoryNameById?: Record<string, string>;
  subcategories?: { slug: string; name: string }[];
  categories?: { slug: string; name: string; count?: number }[];
  currentSlug?: string;
  /** "filter" on the all-products surface (?category= applies in place);
   * "links" on dedicated category pages (rail navigates to #listing). */
  categoryMode?: "links" | "filter";
}) {
  const t = await getTranslations({ locale, namespace: "shop.listing" });
  const wish = new Set(wishlistedIds);

  const view = sp.view === "list" ? "list" : "grid";
  const keepKeys = [
    "q",
    "category",
    "brand",
    "min",
    "max",
    "inStock",
    "deal",
    "rating",
    "sort",
    "view",
  ] as const;
  const buildHref = (
    omit: string[] = [],
    extra: Record<string, string> = {},
  ) => {
    const p = new URLSearchParams();
    for (const k of keepKeys) {
      if (omit.includes(k)) continue;
      const v = sp[k];
      if (v) p.set(k, v);
    }
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // One removable chip per active filter; multi-brand gets one chip per brand
  // (removing one keeps the rest).
  const selectedBrandIds = (sp.brand ?? "").split(",").filter(Boolean);
  const chips: { key: string; label: string; href: string }[] = [];
  if (sp.q)
    chips.push({ key: "q", label: `“${sp.q}”`, href: buildHref(["q"]) });
  if (sp.category) {
    const catName = categories.find((c) => c.slug === sp.category)?.name;
    if (catName)
      chips.push({
        key: "category",
        label: catName,
        href: buildHref(["category"]),
      });
  }
  for (const id of selectedBrandIds) {
    const name = brandNameById[id];
    if (!name) continue;
    const rest = selectedBrandIds.filter((b) => b !== id);
    chips.push({
      key: `brand:${id}`,
      label: name,
      href: rest.length
        ? buildHref(["brand"], { brand: rest.join(",") })
        : buildHref(["brand"]),
    });
  }
  if (sp.min || sp.max)
    chips.push({
      key: "price",
      label: `৳${sp.min ?? "0"} – ৳${sp.max ?? "∞"}`,
      href: buildHref(["min", "max"]),
    });
  if (sp.inStock === "1")
    chips.push({
      key: "inStock",
      label: t("excludeOutOfStock"),
      href: buildHref(["inStock"]),
    });
  if (sp.deal === "1")
    chips.push({
      key: "deal",
      label: t("onSaleOnly"),
      href: buildHref(["deal"]),
    });
  if (sp.rating)
    chips.push({
      key: "rating",
      label: t("starsAndUp", { n: Number(sp.rating) }),
      href: buildHref(["rating"]),
    });

  return (
    <div
      className="equal-2col"
      id="listing"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 260px) 1fr",
        gap: "var(--s-8)",
        alignItems: "start",
        // #listing anchor: land below the sticky header when a category-page
        // rail link jumps here.
        scrollMarginTop: 130,
      }}
    >
      <Filters
        brands={brands}
        showRating
        showDeals
        facets={facets}
        categories={categories}
        currentSlug={currentSlug}
        categoryBasePath="/kart/shop"
        categoryLinkPrefix="/kart/category"
        categoryMode={categoryMode}
      />

      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
      >
        {/* Search — debounced live filtering, no submit needed */}
        <LiveSearch
          placeholder={t("searchPlaceholder")}
          ariaLabel={t("search")}
        />

        {/* Subcategory chips */}
        {subcategories.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {subcategories.map((s) => (
              <Link
                key={s.slug}
                href={`/kart/category/${s.slug}`}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--r-pill)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  fontSize: "var(--fs-body-sm)",
                  textDecoration: "none",
                  color: "var(--color-text)",
                }}
              >
                {s.name}
              </Link>
            ))}
          </div>
        )}

        {/* Toolbar: result count (left) + sort (right) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--s-4)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--fs-body-sm)",
            }}
          >
            {t("resultCount", { count: result.total })}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--s-4)",
            }}
          >
            <SortSelect showRating />
            <ViewToggle />
          </span>
        </div>

        {/* Active filter chips */}
        {chips.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--s-3)",
              flexWrap: "wrap",
            }}
          >
            {chips.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px 4px 12px",
                  borderRadius: "var(--r-pill)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-brand-soft)",
                  color: "var(--color-brand-deep)",
                  fontSize: "var(--fs-caption)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {c.label}
                <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
                  ×
                </span>
              </Link>
            ))}
            <Link
              href={basePath}
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--fs-caption)",
                textDecoration: "underline",
              }}
            >
              {t("clear")}
            </Link>
          </div>
        )}

        {result.items.length === 0 ? (
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              padding: "var(--s-10)",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            {t("noResults")}
          </div>
        ) : view === "list" ? (
          <ListingRows>
            {result.items.map((p) => (
              <ProductListRow
                key={String(p._id)}
                product={p}
                locale={locale}
                mode="marketplace"
                brandName={
                  p.brandId ? brandNameById[String(p.brandId)] : undefined
                }
                categoryName={
                  p.categoryId
                    ? categoryNameById[String(p.categoryId)]
                    : undefined
                }
              />
            ))}
          </ListingRows>
        ) : (
          <ListingGrid>
            {result.items.map((p) => (
              <ProductCard
                key={String(p._id)}
                product={p}
                locale={locale}
                mode="marketplace"
                showSpecs
                brandName={
                  p.brandId ? brandNameById[String(p.brandId)] : undefined
                }
                categoryName={
                  p.categoryId
                    ? categoryNameById[String(p.categoryId)]
                    : undefined
                }
                wishlisted={wish.has(String(p._id))}
              />
            ))}
          </ListingGrid>
        )}

        {result.pages > 1 && (
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              alignItems: "center",
              marginTop: "var(--s-4)",
            }}
          >
            {result.page > 1 && (
              <Link
                href={buildHref([], { page: String(result.page - 1) })}
                style={{ color: "var(--color-brand-deep)" }}
              >
                ← {t("prev")}
              </Link>
            )}
            <span style={{ color: "var(--color-text-muted)" }}>
              {result.page} / {result.pages}
            </span>
            {result.page < result.pages && (
              <Link
                href={buildHref([], { page: String(result.page + 1) })}
                style={{ color: "var(--color-brand-deep)" }}
              >
                {t("next")} →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
