import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { MarketplaceProductListing } from "@/components/marketplace/product-listing";
import {
  listProducts,
  type ProductSort,
} from "@/lib/repositories/products.repo";
import { listBrands, listCategories } from "@/lib/repositories/taxonomy.repo";
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
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketplace.home" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/marketplace/search",
    title: t("allProducts"),
    noindex: true,
  });
}

export default async function MarketplaceSearch({
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
  const nav = await getTranslations({ locale, namespace: "nav" });
  const tm = await getTranslations({ locale, namespace: "marketplace.home" });

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
  // CATEGORY eyebrow: productId-category → name (delete to drop the eyebrow).
  let categoryNameById: Record<string, string> = {};
  try {
    const [r, bs, cs] = await Promise.all([
      listProducts({
        storefront: "marketplace",
        status: "active",
        search: str(sp.q),
        brandId: str(sp.brand),
        minPriceMinor: minMajor != null ? toMinor(minMajor) : undefined,
        maxPriceMinor: maxMajor != null ? toMinor(maxMajor) : undefined,
        minRating: str(sp.rating) ? Number(str(sp.rating)) : undefined,
        inStockOnly: sp.inStock === "1",
        sort: (str(sp.sort) as ProductSort) ?? "newest",
        page,
      }),
      listBrands(),
      listCategories("marketplace"),
    ]);
    result = r;
    brands = bs.map((b) => ({ id: String(b._id), name: localize(b.name, l) }));
    categoryNameById = Object.fromEntries(
      cs.map((c) => [String(c._id), localize(c.name, l)]),
    );
  } catch (e) {
    logger.warn("marketplace search load failed", e);
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

  const q = str(sp.q);
  const title = q ? tm("resultsFor", { q }) : tm("allProducts");

  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: tm("title"), href: "/marketplace" },
          { label: tm("allProducts") },
        ]}
      />
      <Section py="clamp(40px, 5vw, 80px)">
        <Container>
          <MarketplaceProductListing
            locale={l}
            basePath="/marketplace/search"
            sp={spFlat}
            result={result}
            brands={brands}
            brandNameById={brandNameById}
            categoryNameById={categoryNameById}
            wishlistedIds={wishlistedIds}
          />
        </Container>
      </Section>
    </>
  );
}
