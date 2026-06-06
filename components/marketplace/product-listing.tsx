import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CardGrid } from "@/components/ui/card-grid";
import { Filters } from "@/components/shop/filters";
import { ProductCard } from "@/components/shop/product-card";
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

/** Shared faceted listing layout for marketplace category + search pages. */
export async function MarketplaceProductListing({
  locale,
  basePath,
  formAction,
  sp,
  result,
  brands,
  wishlistedIds = [],
  brandNameById = {},
  categoryNameById = {},
  subcategories = [],
  categories = [],
  currentSlug,
}: {
  locale: Locale;
  basePath: string;
  formAction: string;
  sp: SP;
  result: Result;
  brands: { id: string; name: string }[];
  wishlistedIds?: string[];
  brandNameById?: Record<string, string>;
  // CATEGORY eyebrow data (productId-category map); harmless if omitted.
  categoryNameById?: Record<string, string>;
  subcategories?: { slug: string; name: string }[];
  categories?: { slug: string; name: string }[];
  currentSlug?: string;
}) {
  const t = await getTranslations({ locale, namespace: "shop.listing" });
  const wish = new Set(wishlistedIds);

  const keepKeys = [
    "q",
    "brand",
    "min",
    "max",
    "inStock",
    "rating",
    "sort",
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

  const chips: { key: string; label: string; href: string }[] = [];
  if (sp.q)
    chips.push({ key: "q", label: `“${sp.q}”`, href: buildHref(["q"]) });
  if (sp.brand && brandNameById[sp.brand])
    chips.push({
      key: "brand",
      label: brandNameById[sp.brand],
      href: buildHref(["brand"]),
    });
  if (sp.min || sp.max)
    chips.push({
      key: "price",
      label: `৳${sp.min ?? "0"} – ৳${sp.max ?? "∞"}`,
      href: buildHref(["min", "max"]),
    });
  if (sp.inStock === "1")
    chips.push({
      key: "inStock",
      label: t("inStockOnly"),
      href: buildHref(["inStock"]),
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
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 260px) 1fr",
        gap: "var(--s-8)",
        alignItems: "start",
      }}
    >
      <Filters
        brands={brands}
        showRating
        categories={categories}
        currentSlug={currentSlug}
        categoryBasePath="/marketplace"
        categoryLinkPrefix="/marketplace/category"
      />

      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
      >
        {/* Search */}
        <form
          action={formAction}
          method="get"
          role="search"
          style={{ display: "flex", gap: 8 }}
        >
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            style={{
              flex: 1,
              height: 46,
              padding: "0 16px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-pill)",
              background: "var(--color-surface)",
              font: "inherit",
            }}
          />
          {(["brand", "min", "max", "rating", "sort"] as const).map((k) =>
            sp[k] ? (
              <input key={k} type="hidden" name={k} value={sp[k]} />
            ) : null,
          )}
          {sp.inStock === "1" && (
            <input type="hidden" name="inStock" value="1" />
          )}
          <button
            type="submit"
            style={{
              height: 46,
              padding: "0 22px",
              borderRadius: "var(--r-pill)",
              background: "var(--color-brand)",
              color: "#fff",
              border: 0,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("search")}
          </button>
        </form>

        {/* Subcategory chips */}
        {subcategories.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {subcategories.map((s) => (
              <Link
                key={s.slug}
                href={`/marketplace/category/${s.slug}`}
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

        {/* Count + active chips */}
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
          {chips.length > 0 && (
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
          )}
        </div>

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
        ) : (
          <CardGrid columns={3}>
            {result.items.map((p) => (
              <ProductCard
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
                wishlisted={wish.has(String(p._id))}
              />
            ))}
          </CardGrid>
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
