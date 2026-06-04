import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { CardGrid } from "@/components/ui/card-grid";
import { ProductCard } from "@/components/shop/product-card";
import { CategoryMegaGrid } from "@/components/marketplace/category-mega-grid";
import { BannerCarousel } from "@/components/marketplace/banner-carousel";
import { DealSlots } from "@/components/marketplace/deal-slots";
import { TrustStrip } from "@/components/marketplace/trust-strip";
import { listCategoryTree } from "@/lib/repositories/taxonomy.repo";
import { listFeaturedProducts } from "@/lib/repositories/products.repo";
import { listActiveBanners } from "@/lib/repositories/banners.repo";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

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
    path: "/marketplace",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function MarketplaceHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "marketplace.home" });

  let tree: Awaited<ReturnType<typeof listCategoryTree>> = [];
  let featured: Awaited<ReturnType<typeof listFeaturedProducts>> = [];
  let heroBanners: Awaited<ReturnType<typeof listActiveBanners>> = [];
  let dealBanners: Awaited<ReturnType<typeof listActiveBanners>> = [];
  try {
    [tree, featured, heroBanners, dealBanners] = await Promise.all([
      listCategoryTree("marketplace"),
      listFeaturedProducts("marketplace", 8),
      listActiveBanners("hero"),
      listActiveBanners("deal"),
    ]);
  } catch (e) {
    logger.warn("marketplace home load failed", e);
  }

  const gridCategories = tree.map((c) => ({
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    childCount: c.children.length,
  }));

  const hero = heroBanners.map((b) => ({
    id: String(b._id),
    title: b.title,
    subtitle: b.subtitle,
    image: b.image,
    href: b.href,
    cta: b.cta,
  }));
  const deals = dealBanners.map((b) => ({
    id: String(b._id),
    title: b.title,
    subtitle: b.subtitle,
    image: b.image,
    href: b.href,
  }));

  return (
    <Section py="clamp(28px, 4vw, 56px)">
      <Container
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-10)" }}
      >
        {/* Eyebrow + search */}
        <div style={{ display: "grid", gap: "var(--s-4)" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-caption)",
                textTransform: "uppercase",
                letterSpacing: "var(--tracking-eyebrow)",
                color: "var(--color-brand-deep)",
              }}
            >
              {t("eyebrow")}
            </span>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: "var(--fs-h1)",
                color: "var(--color-text-strong)",
                lineHeight: 1.05,
              }}
            >
              {t("title")}
            </h1>
            <p
              style={{
                margin: 0,
                color: "var(--color-text-muted)",
                maxWidth: "60ch",
                fontSize: "var(--fs-body-lg)",
              }}
            >
              {t("lede")}
            </p>
          </div>
          <form
            action={`/${locale}/marketplace/search`}
            method="get"
            role="search"
            style={{ display: "flex", gap: 10, maxWidth: 640 }}
          >
            <input
              type="search"
              name="q"
              placeholder={t("searchPlaceholder")}
              aria-label={t("search")}
              style={{
                flex: 1,
                height: 52,
                padding: "0 20px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-pill)",
                background: "var(--color-surface)",
                font: "inherit",
                fontSize: "var(--fs-body)",
              }}
            />
            <button
              type="submit"
              style={{
                height: 52,
                padding: "0 28px",
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
        </div>

        {hero.length > 0 && <BannerCarousel banners={hero} locale={l} />}

        {/* Categories */}
        {gridCategories.length > 0 && (
          <div style={{ display: "grid", gap: "var(--s-4)" }}>
            <SectionTitle title={t("shopByCategory")} />
            <CategoryMegaGrid categories={gridCategories} locale={l} />
          </div>
        )}

        {deals.length > 0 && (
          <div style={{ display: "grid", gap: "var(--s-4)" }}>
            <SectionTitle title={t("deals")} />
            <DealSlots deals={deals} locale={l} />
          </div>
        )}

        {/* Featured */}
        {featured.length > 0 ? (
          <div style={{ display: "grid", gap: "var(--s-4)" }}>
            <SectionTitle title={t("featured")} />
            <CardGrid columns={4}>
              {featured.map((p) => (
                <ProductCard
                  key={String(p._id)}
                  product={p}
                  locale={l}
                  mode="marketplace"
                />
              ))}
            </CardGrid>
          </div>
        ) : (
          <div
            style={{
              border: "1px dashed var(--color-border)",
              borderRadius: "var(--r-lg)",
              padding: "var(--s-10)",
              textAlign: "center",
              color: "var(--color-text-muted)",
              background: "var(--color-surface)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontWeight: 600,
                color: "var(--color-text-strong)",
              }}
            >
              {t("comingSoonTitle")}
            </p>
            <p
              style={{
                margin: "6px 0 0",
                maxWidth: "48ch",
                marginInline: "auto",
              }}
            >
              {t("comingSoonNote")}
            </p>
          </div>
        )}

        <TrustStrip locale={l} />
      </Container>
    </Section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "var(--s-4)",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-h3)",
          color: "var(--color-text-strong)",
        }}
      >
        {title}
      </h2>
    </div>
  );
}
