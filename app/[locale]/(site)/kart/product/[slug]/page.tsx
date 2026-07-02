import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Truck, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CardGrid } from "@/components/ui/card-grid";
import { JsonLd } from "@/components/ui/json-ld";
import { RecentlyViewed } from "@/components/ui/recently-viewed";
import { Link } from "@/i18n/navigation";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductCard } from "@/components/shop/product-card";
import { ShareButtons } from "@/components/blog/share-buttons";
import { MarketplaceBuyBox } from "@/components/marketplace/buy-box";
import { RatingStars } from "@/components/marketplace/rating-stars";
import {
  ReviewList,
  type ReviewView,
} from "@/components/marketplace/review-list";
import { ReviewForm } from "@/components/marketplace/review-form";
import {
  getProductBySlug,
  listRelatedProducts,
} from "@/lib/repositories/products.repo";
import {
  getBrandById,
  getCategoryById,
  listBrands,
} from "@/lib/repositories/taxonomy.repo";
import { listApprovedByProduct } from "@/lib/repositories/reviews.repo";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { fromMinor } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";
import { localePath } from "@/lib/i18n/intl-locale";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const product = await getProductBySlug(slug, "marketplace").catch(() => null);
  if (!product) return {};
  return pageMetadata({
    locale: locale as Locale,
    path: `/kart/product/${slug}`,
    title: localize(product.name, locale as Locale),
    description: product.description
      ? localize(product.description, locale as Locale)
      : undefined,
    image: product.images?.[0],
  });
}

export default async function MarketplaceProductDetail({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const localeBase = siteConfig.url + localePath(l, "/").replace(/\/$/, "");
  const t = await getTranslations({ locale, namespace: "shop.product" });
  const tm = await getTranslations({
    locale,
    namespace: "marketplace.product",
  });
  const tr = await getTranslations({ locale, namespace: "reviews" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const tmh = await getTranslations({ locale, namespace: "marketplace.home" });

  const product = await getProductBySlug(slug, "marketplace").catch(() => null);
  if (!product) notFound();

  const name = localize(product.name, l);
  const productId = String(product._id);
  const [related, brand, category, reviews, allBrands] = await Promise.all([
    listRelatedProducts(
      String(product.categoryId),
      productId,
      4,
      "marketplace",
    ).catch(() => []),
    product.brandId
      ? getBrandById(String(product.brandId)).catch(() => null)
      : Promise.resolve(null),
    product.categoryId
      ? getCategoryById(String(product.categoryId)).catch(() => null)
      : Promise.resolve(null),
    listApprovedByProduct(productId, 20).catch(() => []),
    listBrands().catch(() => []),
  ]);
  // Brand + category labels for the related rail (categoryName drives the
  // eyebrow — delete the categoryName prop below to drop it).
  const relBrandMap = new Map(
    allBrands.map((b) => [String(b._id), localize(b.name, l)]),
  );
  const relCategoryName = category ? localize(category.name, l) : undefined;

  // Client-safe variant data.
  const options = product.variantOptions.map((o) => ({
    name: o.name.en,
    label: localize(o.name, l),
    values: o.values.map((v) => ({ value: v.en, label: localize(v, l) })),
  }));
  const variants = product.variants.map((v) => ({
    id: v.id,
    options: v.options,
    priceMinor: v.priceMinorOverride ?? product.priceMinor,
    stockQty: v.stockQty,
    sku: v.sku,
  }));

  const reviewViews: ReviewView[] = reviews.map((r) => ({
    id: String(r._id),
    authorName: r.authorName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verifiedPurchase: r.verifiedPurchase,
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  // Build a valid Offer (or AggregateOffer for variant price ranges). Google's
  // Product snippet requires offers | review | aggregateRating, so we only emit
  // Product structured data when it has a resolvable price OR a rating —
  // otherwise it would be flagged invalid (priceless items keep the breadcrumb).
  const priceUrl = `${localeBase}/kart/product/${slug}`;
  const inStock =
    product.stockQty > 0 || product.variants.some((v) => v.stockQty > 0);
  const availability = inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
  const prices = [
    ...(product.priceMinor != null ? [product.priceMinor] : []),
    ...product.variants
      .map((v) => v.priceMinorOverride ?? product.priceMinor)
      .filter((p): p is number => p != null),
  ];
  const lo = prices.length ? Math.min(...prices) : null;
  const hi = prices.length ? Math.max(...prices) : null;
  const offers =
    lo != null && hi != null
      ? lo === hi
        ? {
            "@type": "Offer",
            priceCurrency: "BDT",
            price: fromMinor(lo).toFixed(2),
            availability,
            url: priceUrl,
          }
        : {
            "@type": "AggregateOffer",
            priceCurrency: "BDT",
            lowPrice: fromMinor(lo).toFixed(2),
            highPrice: fromMinor(hi).toFixed(2),
            availability,
            url: priceUrl,
          }
      : undefined;

  const jsonLd =
    offers || product.ratingCount > 0
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          sku: product.sku,
          image: product.images,
          description: product.description
            ? localize(product.description, l)
            : undefined,
          brand: brand
            ? { "@type": "Brand", name: localize(brand.name, l) }
            : undefined,
          ...(offers ? { offers } : {}),
          ...(product.ratingCount > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: product.ratingAvg,
                  reviewCount: product.ratingCount,
                },
              }
            : {}),
        }
      : null;

  const mono: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--fs-caption)",
    color: "var(--color-text-muted)",
  };

  return (
    <section style={{ paddingBlock: "clamp(28px, 4vw, 56px)" }}>
      {jsonLd && <JsonLd data={jsonLd} />}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: nav("home"), url: `${localeBase}` },
          {
            name: tmh("title"),
            url: `${localeBase}/kart`,
          },
          ...(category
            ? [
                {
                  name: localize(category.name, l),
                  url: `${localeBase}/kart/category/${category.slug}`,
                },
              ]
            : []),
          {
            name,
            url: `${localeBase}/kart/product/${slug}`,
          },
        ])}
      />
      <Container
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-10)" }}
      >
        <Breadcrumb
          items={[
            { label: nav("home"), href: "/" },
            { label: tmh("title"), href: "/kart" },
            ...(category
              ? [
                  {
                    label: localize(category.name, l),
                    href: `/kart/category/${category.slug}`,
                  },
                ]
              : []),
            { label: name },
          ]}
        />

        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
            gap: "var(--s-10)",
            alignItems: "start",
          }}
        >
          <ProductGallery images={product.images} name={name} />

          <div style={{ display: "grid", gap: "var(--s-5)" }}>
            {brand && (
              <span style={{ ...mono, color: "var(--color-brand-deep)" }}>
                {localize(brand.name, l)}
              </span>
            )}
            <h1
              style={{
                fontSize: "var(--fs-h2)",
                color: "var(--color-text-strong)",
                lineHeight: 1.12,
                margin: 0,
              }}
            >
              {name}
            </h1>
            {product.ratingCount > 0 && (
              <RatingStars
                value={product.ratingAvg}
                count={product.ratingCount}
                size={16}
              />
            )}

            <hr
              style={{
                border: 0,
                borderTop: "1px solid var(--color-border)",
                margin: 0,
              }}
            />

            <MarketplaceBuyBox
              productId={productId}
              basePriceMinor={product.priceMinor}
              baseStockQty={product.stockQty}
              options={options}
              variants={variants}
              locale={l}
            />

            <ShareButtons title={name} />

            <div
              style={{
                ...mono,
                display: "flex",
                gap: "var(--s-4)",
                flexWrap: "wrap",
              }}
            >
              <span>
                {t("sku")}: {product.sku}
              </span>
              {category && (
                <span>
                  {t("categories")}:{" "}
                  <Link
                    href={`/kart/category/${category.slug}`}
                    style={{ color: "var(--color-brand-deep)" }}
                  >
                    {localize(category.name, l)}
                  </Link>
                </span>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--s-3)",
              }}
            >
              {[
                {
                  icon: Truck,
                  title: t("trustDelivery"),
                  note: t("deliveryNote"),
                },
                {
                  icon: ShieldCheck,
                  title: t("trustGenuine"),
                  note: t("genuineNote"),
                },
              ].map(({ icon: Icon, title, note }) => (
                <div
                  key={title}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "var(--s-3) var(--s-4)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--r-lg)",
                  }}
                >
                  <Icon
                    size={18}
                    color="var(--color-brand)"
                    strokeWidth={1.75}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <div style={{ display: "grid", gap: 2 }}>
                    <strong
                      style={{
                        fontSize: "var(--fs-body-sm)",
                        color: "var(--color-text-strong)",
                      }}
                    >
                      {title}
                    </strong>
                    <span
                      style={{
                        fontSize: "var(--fs-caption)",
                        color: "var(--color-text-muted)",
                        lineHeight: 1.45,
                      }}
                    >
                      {note}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Overview + specs */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-8)",
            maxWidth: 820,
          }}
        >
          {product.description && (
            <SectionBlock title={t("overview")}>
              <p
                style={{
                  color: "var(--color-text)",
                  lineHeight: "var(--lh-body)",
                  whiteSpace: "pre-line",
                  margin: 0,
                }}
              >
                {localize(product.description, l)}
              </p>
            </SectionBlock>
          )}
          {product.specs.length > 0 && (
            <SectionBlock title={t("specifications")}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <tbody>
                  {product.specs.map((s, i) => (
                    <tr
                      key={i}
                      style={{ borderTop: "1px solid var(--color-hairline)" }}
                    >
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 16px 10px 0",
                          color: "var(--color-text-muted)",
                          fontWeight: 500,
                          width: "40%",
                          verticalAlign: "top",
                        }}
                      >
                        {localize(s.key, l)}
                      </th>
                      <td style={{ padding: "10px 0" }}>
                        {localize(s.value, l)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionBlock>
          )}
        </div>

        {/* Reviews */}
        <div style={{ display: "grid", gap: "var(--s-6)", maxWidth: 820 }}>
          <h2
            style={{
              fontSize: "var(--fs-h3)",
              color: "var(--color-text-strong)",
              margin: 0,
            }}
          >
            {tr("sectionTitle")}
          </h2>
          <div
            className="equal-2col"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)",
              gap: "var(--s-6)",
              alignItems: "start",
            }}
          >
            <ReviewList reviews={reviewViews} locale={l} />
            <ReviewForm productId={productId} />
          </div>
        </div>

        {related.length > 0 && (
          <Rail title={tm("more")}>
            <CardGrid columns={4}>
              {related.map((p) => (
                <ProductCard
                  key={String(p._id)}
                  product={p}
                  locale={l}
                  mode="marketplace"
                  brandName={
                    p.brandId ? relBrandMap.get(String(p.brandId)) : undefined
                  }
                  categoryName={relCategoryName}
                />
              ))}
            </CardGrid>
          </Rail>
        )}

        <RecentlyViewed
          title={tm("recentlyViewed")}
          current={{
            href: `/kart/product/${slug}`,
            name,
            image: product.images[0],
            meta: undefined,
          }}
        />
      </Container>
    </section>
  );
}

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
    >
      <h2
        style={{ fontSize: "var(--fs-h4)", color: "var(--color-text-strong)" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Rail({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
    >
      <h2
        style={{ fontSize: "var(--fs-h4)", color: "var(--color-text-strong)" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
