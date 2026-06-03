import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CardGrid } from "@/components/ui/card-grid";
import { Link } from "@/i18n/navigation";
import { Filters } from "@/components/shop/filters";
import { ProductCard } from "@/components/shop/product-card";
import {
  listProducts,
  type ProductSort,
} from "@/lib/repositories/products.repo";
import {
  getCategoryBySlug,
  listBrands,
} from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { toMinor } from "@/lib/money";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale, category } = await params;
  const cat = await getCategoryBySlug(category).catch(() => null);
  const title = cat ? localize(cat.name, locale as Locale) : category;
  return pageMetadata({
    locale: locale as Locale,
    path: `/instruments/${category}`,
    title,
  });
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
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

  const cat = await getCategoryBySlug(category).catch(() => null);
  if (!cat) notFound();

  const page = Math.max(1, parseInt(str(sp.page) ?? "1", 10) || 1);
  const minMajor = str(sp.min) ? Number(str(sp.min)) : undefined;
  const maxMajor = str(sp.max) ? Number(str(sp.max)) : undefined;

  let result: Awaited<ReturnType<typeof listProducts>> = {
    items: [],
    total: 0,
    page,
    pageSize: 12,
    pages: 1,
  };
  let brands: { id: string; name: string }[] = [];
  try {
    const [r, bs] = await Promise.all([
      listProducts({
        status: "active",
        categoryId: String(cat._id),
        search: str(sp.q),
        brandId: str(sp.brand),
        minPriceMinor: minMajor != null ? toMinor(minMajor) : undefined,
        maxPriceMinor: maxMajor != null ? toMinor(maxMajor) : undefined,
        inStockOnly: sp.inStock === "1",
        sort: (str(sp.sort) as ProductSort) ?? "newest",
        page,
      }),
      listBrands(),
    ]);
    result = r;
    brands = bs.map((b) => ({ id: String(b._id), name: localize(b.name, l) }));
  } catch (e) {
    logger.warn("category listing load failed", e);
  }

  // ---- Active-filter chips (server-rendered, removable; reset to page 1) ----
  const base = `/instruments/${category}`;
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
    if (n > 1) p.set("page", String(n));
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <>
      <PageHeader
        title={localize(cat.name, l)}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("instruments"), href: "/instruments" },
          { label: localize(cat.name, l) },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 260px) 1fr",
            gap: "var(--s-8)",
            alignItems: "start",
          }}
          className="equal-2col"
        >
          <Filters brands={brands} />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-5)",
            }}
          >
            {/* Prominent search */}
            <form
              action={`/${locale}/instruments/${category}`}
              method="get"
              role="search"
              style={{ display: "flex", gap: 8 }}
            >
              <input
                type="search"
                name="q"
                defaultValue={str(sp.q) ?? ""}
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
              {str(sp.brand) && (
                <input type="hidden" name="brand" value={str(sp.brand)} />
              )}
              {str(sp.min) && (
                <input type="hidden" name="min" value={str(sp.min)} />
              )}
              {str(sp.max) && (
                <input type="hidden" name="max" value={str(sp.max)} />
              )}
              {sp.inStock === "1" && (
                <input type="hidden" name="inStock" value="1" />
              )}
              {str(sp.sort) && (
                <input type="hidden" name="sort" value={str(sp.sort)} />
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

            {/* Result count + active chips */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-3)",
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
            ) : (
              <CardGrid columns={3}>
                {result.items.map((p) => (
                  <ProductCard key={String(p._id)} product={p} locale={l} />
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
