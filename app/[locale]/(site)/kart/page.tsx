import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { CardGrid } from "@/components/ui/card-grid";
import { ComingSoon } from "@/components/ui/coming-soon";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/shop/product-card";
import {
  KartShopNav,
  type KartNavCategory,
} from "@/components/marketplace/kart/shop-nav";
import {
  KartHeroCarousel,
  type KartBanner,
} from "@/components/marketplace/kart/hero-carousel";
import {
  KartBrandRow,
  KartHelpBento,
  type KartBrand,
} from "@/components/marketplace/kart/sections";
import { KartPromo } from "@/components/marketplace/kart/promo";
import { KartNewsletter } from "@/components/marketplace/kart/newsletter";
import {
  listProducts,
  listFeaturedProducts,
} from "@/lib/repositories/products.repo";
import {
  listBrands,
  listCategoryTree,
  type CategoryNode,
} from "@/lib/repositories/taxonomy.repo";
import { listActiveBanners } from "@/lib/repositories/banners.repo";
import { listWishlistProductIds } from "@/lib/repositories/wishlist.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";
import type { Lean } from "@/lib/models/_shared";
import type { IProduct } from "@/lib/models/product";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketplace.home" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/kart",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

function flattenCats(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((n) => [n, ...flattenCats(n.children)]);
}

/** Section heading + optional "view all" (no eyebrow, per taste discipline). */
function Head({
  title,
  href,
  cta,
}: {
  title: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="kart-head">
      <h2>{title}</h2>
      {href && cta && (
        <Link href={href} className="kart-more">
          {cta}
          <ArrowRight size={15} aria-hidden />
        </Link>
      )}
    </div>
  );
}

export default async function KartHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const tm = await getTranslations({ locale, namespace: "marketplace.home" });
  const tBest = await getTranslations({
    locale,
    namespace: "marketplace.bestSellers",
  });
  const tPrice = await getTranslations({
    locale,
    namespace: "marketplace.priceCheck",
  });

  let brandsRaw: Awaited<ReturnType<typeof listBrands>> = [];
  let featured: Lean<IProduct>[] = [];
  let topRated: Lean<IProduct>[] = [];
  let cheapest: Lean<IProduct>[] = [];
  let totalProducts = 0;
  let dealBanners: Awaited<ReturnType<typeof listActiveBanners>> = [];
  let heroBanners: Awaited<ReturnType<typeof listActiveBanners>> = [];
  let catTree: Awaited<ReturnType<typeof listCategoryTree>> = [];
  try {
    const [bs, feat, top, low, db, hb, ct] = await Promise.all([
      listBrands(),
      listFeaturedProducts("marketplace", 10),
      listProducts({
        storefront: "marketplace",
        status: "active",
        sort: "rating_desc",
        minRating: 1,
        pageSize: 10,
      }),
      listProducts({
        storefront: "marketplace",
        status: "active",
        sort: "price_asc",
        pageSize: 12,
      }),
      listActiveBanners("deal"),
      listActiveBanners("hero"),
      listCategoryTree("marketplace"),
    ]);
    brandsRaw = bs;
    featured = feat;
    topRated = top.items;
    cheapest = low.items;
    totalProducts = low.total;
    dealBanners = db;
    heroBanners = hb;
    catTree = ct;
  } catch (e) {
    logger.warn("kart home load failed", e);
  }

  const sessionUser = await getSessionUser().catch(() => null);
  const wishlistedIds = sessionUser
    ? await listWishlistProductIds(sessionUser.sub).catch((): string[] => [])
    : [];
  const wish = new Set(wishlistedIds);

  const brandNameById = Object.fromEntries(
    brandsRaw.map((b) => [String(b._id), localize(b.name, l)]),
  );
  const categoryNameById = Object.fromEntries(
    flattenCats(catTree).map((c) => [String(c._id), localize(c.name, l)]),
  );

  // Best sellers = featured first, then top-rated (deduped).
  const seen = new Set<string>();
  const bestSellers: Lean<IProduct>[] = [];
  for (const p of [...featured, ...topRated]) {
    const id = String(p._id);
    if (seen.has(id)) continue;
    seen.add(id);
    bestSellers.push(p);
    if (bestSellers.length >= 10) break;
  }

  const brandTiles: KartBrand[] = brandsRaw.slice(0, 12).map((b) => ({
    id: String(b._id),
    name: localize(b.name, l),
    logo: b.logo,
  }));

  const heroSlides: KartBanner[] = heroBanners.map((b) => ({
    id: String(b._id),
    title: localize(b.title, l),
    subtitle: b.subtitle ? localize(b.subtitle, l) : undefined,
    image: b.image,
    href: b.href,
    cta: b.cta ? localize(b.cta, l) : undefined,
  }));
  const navCats: KartNavCategory[] = catTree.map((c) => ({
    id: String(c._id),
    name: localize(c.name, l),
    slug: c.slug,
    children: c.children.map((s) => ({
      id: String(s._id),
      name: localize(s.name, l),
      slug: s.slug,
    })),
  }));

  const deal = dealBanners[0];
  const dealImages = deal
    ? deal.images?.length
      ? deal.images
      : deal.image
        ? [deal.image]
        : []
    : [];

  const hasProducts = totalProducts > 0;

  const rail = (p: Lean<IProduct>) => (
    <ProductCard
      key={String(p._id)}
      product={p}
      locale={l}
      mode="marketplace"
      brandName={p.brandId ? brandNameById[String(p.brandId)] : undefined}
      categoryName={
        p.categoryId ? categoryNameById[String(p.categoryId)] : undefined
      }
      wishlisted={wish.has(String(p._id))}
    />
  );

  return (
    <>
      <KartShopNav categories={navCats} />
      <KartHeroCarousel banners={heroSlides} />

      {/* Top brands (logo wall) */}
      {brandTiles.length > 0 && (
        <Section
          py="clamp(36px, 4.5vw, 64px)"
          style={{ background: "var(--color-surface-2)" }}
        >
          <Container>
            <KartBrandRow brands={brandTiles} locale={l} />
          </Container>
        </Section>
      )}

      {/* Limited-time promo (full-width band, admin Deal banner) */}
      {deal && (
        <KartPromo
          title={localize(deal.title, l)}
          note={deal.subtitle ? localize(deal.subtitle, l) : undefined}
          cta={deal.cta ? localize(deal.cta, l) : undefined}
          href={deal.href || "/kart/shop"}
          images={dealImages}
          endsAt={deal.endsAt ? new Date(deal.endsAt).toISOString() : null}
        />
      )}

      {hasProducts ? (
        <>
          {/* Best sellers (grid) */}
          {bestSellers.length > 0 && (
            <Section
              py="clamp(40px, 5vw, 72px)"
              style={{ background: "var(--color-surface-2)" }}
            >
              <Container>
                <Head
                  title={tBest("title")}
                  href="/kart/shop?sort=rating_desc"
                  cta={tBest("viewAll")}
                />
                <CardGrid columns={5}>{bestSellers.map(rail)}</CardGrid>
              </Container>
            </Section>
          )}

          {/* Great value (horizontal scroll rail) */}
          {cheapest.length > 0 && (
            <Section py="clamp(40px, 5vw, 72px)">
              <Container>
                <Head
                  title={tPrice("title")}
                  href="/kart/shop?sort=price_asc"
                  cta={tPrice("viewAll")}
                />
                <div className="kart-rail">
                  {cheapest.map((p) => (
                    <div key={String(p._id)} className="kart-rail-item">
                      {rail(p)}
                    </div>
                  ))}
                </div>
              </Container>
            </Section>
          )}
        </>
      ) : (
        <ComingSoon
          eyebrow={tm("eyebrow")}
          title={tm("comingSoonTitle")}
          description={tm("comingSoonNote")}
        />
      )}

      {/* Help & services (asymmetric bento) */}
      <Section
        py="clamp(40px, 5vw, 72px)"
        style={{ background: "var(--color-surface-2)" }}
      >
        <Container>
          <KartHelpBento locale={l} />
        </Container>
      </Section>

      {/* Newsletter (scroll-expanding CTA banner; own section) */}
      <KartNewsletter />
    </>
  );
}
