import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
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
  listCategories,
  listBrands,
  categoryWithDescendantIds,
  rollupCategoryCounts,
} from "@/lib/repositories/taxonomy.repo";
import { listWishlistProductIds } from "@/lib/repositories/wishlist.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { INSTRUMENTS_HUB_IMAGES } from "@/lib/hero-images";
import { toMinor } from "@/lib/money";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;
const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop.hub" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/medtrade",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function InstrumentsHub({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SP;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "shop" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const hub = await getTranslations({ locale, namespace: "hubs.instruments" });

  const page = Math.max(1, parseInt(str(sp.page) ?? "1", 10) || 1);
  const minMajor = str(sp.min) ? Number(str(sp.min)) : undefined;
  const maxMajor = str(sp.max) ? Number(str(sp.max)) : undefined;
  const brandIds = (str(sp.brand) ?? "").split(",").filter(Boolean);
  const categorySlug = str(sp.category);
  const hasFilter = Boolean(
    str(sp.q) ||
    str(sp.brand) ||
    str(sp.min) ||
    str(sp.max) ||
    sp.inStock ||
    categorySlug,
  );

  let result: Awaited<ReturnType<typeof listProducts>> = {
    items: [],
    total: 0,
    page,
    pageSize: 12,
    pages: 1,
  };
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  let brands: { id: string; name: string }[] = [];
  let facets: ProductFacets | undefined;
  let catTotals: Record<string, number> = {};
  try {
    // Categories first: the ?category= facet resolves slug → descendant ids.
    const cs = await listCategories("instruments");
    categories = cs;
    const selectedCat = categorySlug
      ? cs.find((c) => c.slug === categorySlug)
      : undefined;
    const categoryIds = selectedCat
      ? await categoryWithDescendantIds(String(selectedCat._id), "instruments")
      : undefined;

    const listParams = {
      storefront: "instruments" as const,
      status: "active" as const,
      categoryIds,
      search: str(sp.q),
      brandIds: brandIds.length ? brandIds : undefined,
      minPriceMinor: minMajor != null ? toMinor(minMajor) : undefined,
      maxPriceMinor: maxMajor != null ? toMinor(maxMajor) : undefined,
      inStockOnly: sp.inStock === "1",
      sort: (str(sp.sort) as ProductSort) ?? "newest",
      pageSize: 24,
    };
    const [r, bs, fx] = await Promise.all([
      listProducts({ ...listParams, page }),
      listBrands(),
      getProductFacets(listParams),
    ]);
    result = r;
    facets = fx;
    catTotals = rollupCategoryCounts(cs, fx.categoryCounts ?? {});
    brands = bs.map((b) => ({ id: String(b._id), name: localize(b.name, l) }));
  } catch (e) {
    logger.warn("instruments catalog load failed", e);
  }

  const brandMap = new Map(brands.map((b) => [b.id, b.name]));
  // CATEGORY eyebrow: productId-category → name (delete to drop the eyebrow).
  const catMap = new Map(
    categories.map((c) => [String(c._id), localize(c.name, l)]),
  );
  const sessionUser = await getSessionUser().catch(() => null);
  const wish = sessionUser
    ? new Set(await listWishlistProductIds(sessionUser.sub).catch(() => []))
    : new Set<string>();

  const base = "/medtrade";
  const hrefWithout = (...omit: string[]) => {
    const p = new URLSearchParams();
    const keep = (k: string, v?: string) => {
      if (v && !omit.includes(k)) p.set(k, v);
    };
    keep("q", str(sp.q));
    keep("category", categorySlug);
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
    keep("category", categorySlug);
    if (rest.length) p.set("brand", rest.join(","));
    keep("min", str(sp.min));
    keep("max", str(sp.max));
    if (sp.inStock === "1") p.set("inStock", "1");
    keep("sort", str(sp.sort));
    keep("view", str(sp.view));
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    const keep = (k: string, v?: string) => {
      if (v) p.set(k, v);
    };
    keep("q", str(sp.q));
    keep("category", categorySlug);
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

  const chips: { key: string; label: string; href: string }[] = [];
  if (str(sp.q))
    chips.push({
      key: "q",
      label: `“${str(sp.q)}”`,
      href: hrefWithout("q", "page"),
    });
  if (categorySlug) {
    const catName = categories.find((c) => c.slug === categorySlug);
    if (catName)
      chips.push({
        key: "category",
        label: localize(catName.name, l),
        href: hrefWithout("category", "page"),
      });
  }
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
      label: t("listing.inStockOnly"),
      href: hrefWithout("inStock", "page"),
    });

  return (
    <>
      <PageHeader
        eyebrow={hub("eyebrow")}
        title={t("hub.title")}
        description={t("hub.lede")}
        images={INSTRUMENTS_HUB_IMAGES}
        imageAlt={t("hub.title")}
        stats={[
          { value: String(brands.length), label: t("listing.allBrands") },
          {
            value: String(categories.filter((c) => !c.parentId).length),
            label: t("listing.categories"),
          },
          { value: String(result.total), label: t("listing.allProducts") },
        ]}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("hub.title") },
        ]}
      />

      {result.total === 0 && !hasFilter ? (
        <ComingSoon />
      ) : (
        <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
          <Container
            style={{ display: "grid", gap: "var(--s-8)", maxWidth: "none" }}
          >
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
                facets={facets}
                categories={categories
                  .filter((c) => !c.parentId)
                  .map((c) => ({
                    slug: c.slug,
                    name: localize(c.name, l),
                    count: catTotals[String(c._id)] ?? 0,
                  }))}
                categoryBasePath="/medtrade"
                categoryMode="filter"
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
                  placeholder={t("listing.searchPlaceholder")}
                  ariaLabel={t("listing.search")}
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
                    {t("listing.resultCount", { count: result.total })}
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
                      {t("listing.clear")}
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
                    {t("listing.noResults")}
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
                          p.brandId
                            ? brandMap.get(String(p.brandId))
                            : undefined
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
                          p.brandId
                            ? brandMap.get(String(p.brandId))
                            : undefined
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
                        ← {t("listing.prev")}
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
                        {t("listing.next")} →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
