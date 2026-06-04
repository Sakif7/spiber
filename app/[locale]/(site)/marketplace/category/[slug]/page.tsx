import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { MarketplaceProductListing } from "@/components/marketplace/product-listing";
import {
  listProducts,
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
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const cat = await getCategoryBySlug(slug, "marketplace").catch(() => null);
  const title = cat ? localize(cat.name, locale as Locale) : slug;
  return pageMetadata({
    locale: locale as Locale,
    path: `/marketplace/category/${slug}`,
    title,
  });
}

export default async function MarketplaceCategory({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: SP;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const sp = await searchParams;
  const nav = await getTranslations({ locale, namespace: "nav" });
  const tm = await getTranslations({ locale, namespace: "marketplace.home" });

  const cat = await getCategoryBySlug(slug, "marketplace").catch(() => null);
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
  let subcategories: { slug: string; name: string }[] = [];
  try {
    const [ids, flat, bs] = await Promise.all([
      categoryWithDescendantIds(String(cat._id), "marketplace"),
      listCategories("marketplace"),
      listBrands(),
    ]);
    subcategories = flat
      .filter((c) => String(c.parentId) === String(cat._id))
      .map((c) => ({ slug: c.slug, name: localize(c.name, l) }));
    brands = bs.map((b) => ({ id: String(b._id), name: localize(b.name, l) }));
    result = await listProducts({
      storefront: "marketplace",
      status: "active",
      categoryIds: ids,
      search: str(sp.q),
      brandId: str(sp.brand),
      minPriceMinor: minMajor != null ? toMinor(minMajor) : undefined,
      maxPriceMinor: maxMajor != null ? toMinor(maxMajor) : undefined,
      minRating: str(sp.rating) ? Number(str(sp.rating)) : undefined,
      inStockOnly: sp.inStock === "1",
      sort: (str(sp.sort) as ProductSort) ?? "newest",
      page,
    });
  } catch (e) {
    logger.warn("marketplace category load failed", e);
  }

  const brandNameById = Object.fromEntries(brands.map((b) => [b.id, b.name]));
  const sessionUser = await getSessionUser().catch(() => null);
  const wishlistedIds = sessionUser
    ? await listWishlistProductIds(sessionUser.sub).catch((): string[] => [])
    : [];

  const spFlat: Record<string, string | undefined> = {
    q: str(sp.q),
    brand: str(sp.brand),
    min: str(sp.min),
    max: str(sp.max),
    inStock: sp.inStock === "1" ? "1" : undefined,
    rating: str(sp.rating),
    sort: str(sp.sort),
  };

  return (
    <>
      <PageHeader
        title={localize(cat.name, l)}
        description={cat.description ? localize(cat.description, l) : undefined}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: tm("title"), href: "/marketplace" },
          { label: localize(cat.name, l) },
        ]}
      />
      <Section py="clamp(40px, 5vw, 80px)">
        <Container>
          <MarketplaceProductListing
            locale={l}
            basePath={`/marketplace/category/${slug}`}
            formAction={`/${locale}/marketplace/category/${slug}`}
            sp={spFlat}
            result={result}
            brands={brands}
            brandNameById={brandNameById}
            wishlistedIds={wishlistedIds}
            subcategories={subcategories}
          />
        </Container>
      </Section>
    </>
  );
}
