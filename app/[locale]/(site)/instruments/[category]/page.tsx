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
              gap: "var(--s-6)",
            }}
          >
            <p
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--fs-body-sm)",
              }}
            >
              {t("results", { count: result.total })}
            </p>
            {result.items.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>
                {t("noResults")}
              </p>
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
                  marginTop: "var(--s-4)",
                }}
              >
                {page > 1 && (
                  <Link
                    href={`/instruments/${category}?page=${page - 1}`}
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
                    href={`/instruments/${category}?page=${page + 1}`}
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
