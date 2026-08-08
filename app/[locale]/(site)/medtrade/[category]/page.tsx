import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { LiveSearch } from "@/components/ui/live-search";
import { Link } from "@/i18n/navigation";
import { Filters } from "@/components/shop/filters";
import { SortSelect } from "@/components/shop/sort-select";
import { ViewToggle } from "@/components/shop/view-toggle";
import { ListingGrid, ListingRows } from "@/components/shop/listing-grid";
import { ProductCard } from "@/components/shop/product-card";
import { ProductListRow } from "@/components/shop/product-list-row";
import {
  listProducts,
  getProductFacets,
  type ProductFacets,
  type ProductSort,
} from "@/lib/repositories/products.repo";
import {
  getCategoryBySlug,
  listBrands,
  listCategories,
  categoryWithDescendantIds,
} from "@/lib/repositories/taxonomy.repo";
import { listWishlistProductIds } from "@/lib/repositories/wishlist.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { instrumentsHero } from "@/lib/hero-images";
import { toMinor } from "@/lib/money";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; category: string }>;
  searchParams: SP;
}) {
  const { locale, category } = await params;
  const cat = await getCategoryBySlug(category).catch(() => null);
  const title = cat ? localize(cat.name, locale as Locale) : category;
  const sp = await searchParams;
  const pageN = parseInt(str(sp.page) ?? "1", 10) || 1;
  const filtered =
    pageN > 1 ||
    !!str(sp.q) ||
    !!str(sp.brand) ||
    !!str(sp.min) ||
    !!str(sp.max) ||
    sp.inStock === "1" ||
    !!str(sp.sort);
  return pageMetadata({
    locale: locale as Locale,
    path: `/medtrade/${category}`,
    title,
    noindex: filtered,
  });
}

export default async function CategoryListing({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; category: string }>;
  searchParams: SP;
}) {
  const { locale, category } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "shop.listing" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const cat = await getCategoryBySlug(category, "instruments").catch(
    () => null,
  );
  if (!cat) notFound();

  const page = Math.max(1, parseInt(str(sp.page) ?? "1", 10) || 1);
  const minMajor = str(sp.min) ? Number(str(sp.min)) : undefined;
  const maxMajor = str(sp.max) ? Number(str(sp.max)) : undefined;
  const brandIds = (str(sp.brand) ?? "").split(",").filter(Boolean);

  let result: Awaited<ReturnType<typeof listProducts>> = {
    items: [],
    total: 0,
    page,
    pageSize: 12,
    pages: 1,
  };
  let brands: { id: string; name: string }[] = [];
  let categoryNav: { slug: string; name: string }[] = [];
  // CATEGORY eyebrow: productId-category → name (delete to drop the eyebrow).
  let catMap = new Map<string, string>();
  let facets: ProductFacets | undefined;
  const catIds = await categoryWithDescendantIds(
    String(cat._id),
    "instruments",
  ).catch(() => [String(cat._id)]);
  try {
    const listParams = {
      storefront: "instruments" as const,
      status: "active" as const,
      categoryIds: catIds,
      search: str(sp.q),
      brandIds: brandIds.length ? brandIds : undefined,
      minPriceMinor: minMajor != null ? toMinor(minMajor) : undefined,
      maxPriceMinor: maxMajor != null ? toMinor(maxMajor) : undefined,
      inStockOnly: sp.inStock === "1",
      sort: (str(sp.sort) as ProductSort) ?? "newest",
      pageSize: 24,
    };
    const [r, bs, cs, fx] = await Promise.all([
      listProducts({ ...listParams, page }),
      listBrands(),
      listCategories("instruments"),
      getProductFacets(listParams),
    ]);
    result = r;
    facets = fx;
    brands = bs.map((b) => ({ id: String(b._id), name: localize(b.name, l) }));
    categoryNav = cs
      .filter((c) => !c.parentId)
      .map((c) => ({ slug: c.slug, name: localize(c.name, l) }));
    catMap = new Map(cs.map((c) => [String(c._id), localize(c.name, l)]));
  } catch (e) {
    logger.warn("category listing load failed", e);
  }

  const brandMap = new Map(brands.map((b) => [b.id, b.name]));
  const sessionUser = await getSessionUser().catch(() => null);
  const wish = sessionUser
    ? new Set(await listWishlistProductIds(sessionUser.sub).catch(() => []))
    : new Set<string>();

  // ---- Active-filter chips (server-rendered, removable; reset to page 1) ----
  const base = `/medtrade/${category}`;
  const hrefWithout = (...omit: string[]) => {
    const p = new URLSearchParams();
    const keep = (k: string, v?: string) => {
      if (v && !omit.includes(k)) p.set(k, v);
    };
    keep("q", str(sp.q));
    keep("brand", str(sp.brand));
    keep("min", str(sp.min));
    keep("max", str(sp.max));
    if (sp.inStock === "1" && !omit.includes("inStock")) p.set("inStock", "1");
    keep("sort", str(sp.sort));
    keep("view", str(sp.view));
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };
  /** Removing ONE brand chip keeps the remaining multi-selection. */
  const hrefKeepingBrand = (rest: string[]) => {
    const p = new URLSearchParams();
    const keep = (k: string, v?: string) => {
      if (v) p.set(k, v);
    };
    keep("q", str(sp.q));
    if (rest.length) p.set("brand", rest.join(","));
    keep("min", str(sp.min));
    keep("max", str(sp.max));
    if (sp.inStock === "1") p.set("inStock", "1");
    keep("sort", str(sp.sort));
    keep("view", str(sp.view));
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const chips: { key: string; label: string; href: string }[] = [];
  if (str(sp.q))
    chips.push({
      key: "q",
      label: `“${str(sp.q)}”`,
      href: hrefWithout("q", "page"),
    });
  for (const id of brandIds) {
    const bn = brands.find((b) => b.id === id)?.name;
    if (!bn) continue;
    const rest = brandIds.filter((b) => b !== id);
    chips.push({
      key: `brand:${id}`,
      label: bn,
      href: hrefKeepingBrand(rest),
    });
  }
  if (str(sp.min) || str(sp.max))
    chips.push({
      key: "price",
      label: `৳${str(sp.min) ?? "0"} – ৳${str(sp.max) ?? "∞"}`,
      href: hrefWithout("min", "max", "page"),
    });
  if (sp.inStock === "1")
    chips.push({
      key: "inStock",
      label: t("inStockOnly"),
      href: hrefWithout("inStock", "page"),
    });

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    const keep = (k: string, v?: string) => {
      if (v) p.set(k, v);
    };
    keep("q", str(sp.q));
    keep("brand", str(sp.brand));
    keep("min", str(sp.min));
    keep("max", str(sp.max));
    if (sp.inStock === "1") p.set("inStock", "1");
    keep("sort", str(sp.sort));
    keep("view", str(sp.view));
    if (n > 1) p.set("page", String(n));
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <>
      <PageHeader
        title={localize(cat.name, l)}
        image={instrumentsHero(category)}
        imageAlt={localize(cat.name, l)}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("instruments"), href: "/medtrade" },
          { label: localize(cat.name, l) },
        ]}
      />
      <section
        id="listing"
        style={{
          paddingBlock: "clamp(40px, 5vw, 80px)",
          // Rail links land here (below the sticky header), not on the hero.
          scrollMarginTop: 120,
        }}
      >
        <Container
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 260px) 1fr",
            gap: "var(--s-8)",
            alignItems: "start",
            maxWidth: "none",
          }}
          className="equal-2col"
        >
          <Filters
            brands={brands}
            facets={facets}
            categories={categoryNav}
            currentSlug={category}
            categoryBasePath="/medtrade"
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-5)",
            }}
          >
            {/* Prominent search — debounced live, no submit needed */}
            <LiveSearch
              placeholder={t("searchPlaceholder")}
              ariaLabel={t("search")}
            />

            {/* Toolbar: result count + sort (sort moved out of the sidebar) */}
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
                {t("results", { count: result.total })}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--s-4)",
                }}
              >
                <SortSelect />
                <ViewToggle />
              </span>
            </div>

            {/* Active chips */}
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
                  href={base}
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
            ) : str(sp.view) === "list" ? (
              <ListingRows>
                {result.items.map((p) => (
                  <ProductListRow
                    key={String(p._id)}
                    product={p}
                    locale={l}
                    mode="instruments"
                    brandName={
                      p.brandId ? brandMap.get(String(p.brandId)) : undefined
                    }
                    categoryName={
                      p.categoryId
                        ? catMap.get(String(p.categoryId))
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
                    locale={l}
                    mode="instruments"
                    showSpecs
                    brandName={
                      p.brandId ? brandMap.get(String(p.brandId)) : undefined
                    }
                    categoryName={
                      p.categoryId
                        ? catMap.get(String(p.categoryId))
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
                {page > 1 && (
                  <Link
                    href={pageHref(page - 1)}
                    style={{ color: "var(--color-brand-deep)" }}
                  >
                    ← {t("prev")}
                  </Link>
                )}
                <span style={{ color: "var(--color-text-muted)" }}>
                  {page} / {result.pages}
                </span>
                {page < result.pages && (
                  <Link
                    href={pageHref(page + 1)}
                    style={{ color: "var(--color-brand-deep)" }}
                  >
                    {t("next")} →
                  </Link>
                )}
              </div>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
