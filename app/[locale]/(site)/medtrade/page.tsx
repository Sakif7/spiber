import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { LiveSearch } from "@/components/ui/live-search";
import { Link } from "@/i18n/navigation";
import { Filters } from "@/components/shop/filters";
import { ProductCard } from "@/components/shop/product-card";
import {
  listProducts,
  type ProductSort,
} from "@/lib/repositories/products.repo";
import { listCategories, listBrands } from "@/lib/repositories/taxonomy.repo";
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
  const hasFilter = Boolean(
    str(sp.q) || str(sp.brand) || str(sp.min) || str(sp.max) || sp.inStock,
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
  try {
    const [r, cs, bs] = await Promise.all([
      listProducts({
        storefront: "instruments",
        status: "active",
        search: str(sp.q),
        brandId: str(sp.brand),
        minPriceMinor: minMajor != null ? toMinor(minMajor) : undefined,
        maxPriceMinor: maxMajor != null ? toMinor(maxMajor) : undefined,
        inStockOnly: sp.inStock === "1",
        sort: (str(sp.sort) as ProductSort) ?? "newest",
        page,
      }),
      listCategories("instruments"),
      listBrands(),
    ]);
    result = r;
    categories = cs;
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
    keep("brand", str(sp.brand));
    keep("min", str(sp.min));
    keep("max", str(sp.max));
    if (sp.inStock === "1" && !omit.includes("inStock")) p.set("inStock", "1");
    keep("sort", str(sp.sort));
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };
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
  if (str(sp.brand)) {
    const bn = brands.find((b) => b.id === str(sp.brand))?.name;
    if (bn)
      chips.push({
        key: "brand",
        label: bn,
        href: hrefWithout("brand", "page"),
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
          <Container style={{ display: "grid", gap: "var(--s-8)" }}>
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
                categories={categories
                  .filter((c) => !c.parentId)
                  .map((c) => ({
                    slug: c.slug,
                    name: localize(c.name, l),
                  }))}
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
                  placeholder={t("listing.searchPlaceholder")}
                  ariaLabel={t("listing.search")}
                />

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
                ) : (
                  <CardGrid columns={3}>
                    {result.items.map((p) => (
                      <ProductCard
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
