import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { CreditCard, Truck, BadgeCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CardGrid } from "@/components/ui/card-grid";
import { JsonLd } from "@/components/ui/json-ld";
import { RecentlyViewed } from "@/components/ui/recently-viewed";
import { Link } from "@/i18n/navigation";
import { ProductGallery } from "@/components/shop/product-gallery";
import { BuyBox } from "@/components/shop/buy-box";
import { WishlistButton } from "@/components/shop/wishlist-button";
import { ProductCard } from "@/components/shop/product-card";
import { PriceTag } from "@/components/shop/price-tag";
import { ShareButtons } from "@/components/blog/share-buttons";
import {
  getProductBySlug,
  listRelatedProducts,
  frequentlyBoughtTogether,
} from "@/lib/repositories/products.repo";
import {
  getBrandById,
  getCategoryById,
} from "@/lib/repositories/taxonomy.repo";
import { listWishlistProductIds } from "@/lib/repositories/wishlist.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import { fromMinor } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) return {};
  return pageMetadata({
    locale: locale as Locale,
    path: `/instruments/product/${slug}`,
    title: localize(product.name, locale as Locale),
    description: product.description
      ? localize(product.description, locale as Locale)
      : undefined,
  });
}

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "shop.product" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) notFound();

  const name = localize(product.name, l);
  const productId = String(product._id);
  const sessionUser = await getSessionUser().catch(() => null);
  const [related, fbt, brand, category, wishIds] = await Promise.all([
    listRelatedProducts(String(product.categoryId), productId).catch(() => []),
    frequentlyBoughtTogether(productId).catch(() => []),
    product.brandId
      ? getBrandById(String(product.brandId)).catch(() => null)
      : Promise.resolve(null),
    product.categoryId
      ? getCategoryById(String(product.categoryId)).catch(() => null)
      : Promise.resolve(null),
    sessionUser
      ? listWishlistProductIds(sessionUser.sub).catch((): string[] => [])
      : Promise.resolve<string[]>([]),
  ]);
  const wishlisted = wishIds.includes(productId);

  const out = product.stockQty <= 0;
  const low = !out && product.stockQty <= product.lowStockThreshold;
  const stockLabel = out
    ? t("outOfStock")
    : low
      ? t("lowStock", { count: product.stockQty })
      : t("inStock");
  const stockColor = out
    ? "var(--color-error)"
    : low
      ? "var(--color-secondary-deep)"
      : "var(--color-success)";

  const jsonLd = {
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
    offers: {
      "@type": "Offer",
      priceCurrency: "BDT",
      price: fromMinor(product.priceMinor).toFixed(2),
      availability:
        product.stockQty > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${siteConfig.url}/${l}/instruments/product/${slug}`,
    },
  };

  const mono: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--fs-caption)",
    color: "var(--color-text-muted)",
  };

  return (
    <section style={{ paddingBlock: "clamp(28px, 4vw, 56px)" }}>
      <JsonLd data={jsonLd} />
      <Container
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-10)" }}
      >
        <Breadcrumb
          items={[
            { label: nav("home"), href: "/" },
            { label: nav("instruments"), href: "/instruments" },
            ...(category
              ? [
                  {
                    label: localize(category.name, l),
                    href: `/instruments/${category.slug}`,
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

          {/* Buy column */}
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

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "var(--s-4)",
                flexWrap: "wrap",
              }}
            >
              <PriceTag
                minor={product.priceMinor}
                locale={l}
                style={{
                  fontSize: "var(--fs-h2)",
                  fontFamily: "var(--font-display)",
                  color: "var(--color-brand-deep)",
                  fontWeight: 700,
                }}
              />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "var(--fs-body-sm)",
                  fontWeight: 600,
                  color: stockColor,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: stockColor,
                  }}
                />
                {stockLabel}
              </span>
            </div>

            <hr
              style={{
                border: 0,
                borderTop: "1px solid var(--color-border)",
                margin: 0,
              }}
            />

            {/* Offline-payment info (honest Klarna equivalent) */}
            <div
              style={{
                display: "flex",
                gap: "var(--s-3)",
                alignItems: "flex-start",
                padding: "var(--s-4)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-lg)",
                background: "var(--color-surface-2)",
              }}
            >
              <CreditCard
                size={20}
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
                  {t("payOffline")}
                </strong>
                <span
                  style={{
                    fontSize: "var(--fs-caption)",
                    color: "var(--color-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {t("payOfflineNote")}
                </span>
              </div>
            </div>

            <BuyBox productId={productId} stockQty={product.stockQty} />

            <div
              style={{
                display: "flex",
                gap: "var(--s-5)",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <WishlistButton
                productId={productId}
                initialWishlisted={wishlisted}
                withLabel
              />
              <Link
                href="/contact"
                style={{
                  fontSize: "var(--fs-body-sm)",
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                }}
              >
                {t("requestQuote")}
              </Link>
            </div>

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
                    href={`/instruments/${category.slug}`}
                    style={{ color: "var(--color-brand-deep)" }}
                  >
                    {localize(category.name, l)}
                  </Link>
                </span>
              )}
            </div>

            {product.description && (
              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-muted)",
                  lineHeight: "var(--lh-body)",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {localize(product.description, l)}
              </p>
            )}

            {/* Delivery / genuine info boxes */}
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
                  icon: BadgeCheck,
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

        {/* Sections */}
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

          <SectionBlock title={t("shipping")}>
            <p
              style={{
                color: "var(--color-text-muted)",
                lineHeight: "var(--lh-body)",
                margin: 0,
              }}
            >
              {t("shippingBody")}
            </p>
          </SectionBlock>
        </div>

        {fbt.length > 0 && (
          <Rail title={t("frequentlyBought")}>
            <CardGrid columns={4}>
              {fbt.map((p) => (
                <ProductCard key={String(p._id)} product={p} locale={l} />
              ))}
            </CardGrid>
          </Rail>
        )}

        {related.length > 0 && (
          <Rail title={t("youMayLike")}>
            <CardGrid columns={4}>
              {related.map((p) => (
                <ProductCard key={String(p._id)} product={p} locale={l} />
              ))}
            </CardGrid>
          </Rail>
        )}

        <RecentlyViewed
          title={t("recentlyViewed")}
          current={{
            href: `/instruments/product/${slug}`,
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
