import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ShieldCheck, BadgeCheck, Truck, Headset } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CardGrid } from "@/components/ui/card-grid";
import { JsonLd } from "@/components/ui/json-ld";
import { RecentlyViewed } from "@/components/ui/recently-viewed";
import { ProductGallery } from "@/components/shop/product-gallery";
import { AddToCart } from "@/components/shop/add-to-cart";
import { ProductCard } from "@/components/shop/product-card";
import { PriceTag } from "@/components/shop/price-tag";
import {
  getProductBySlug,
  listRelatedProducts,
  frequentlyBoughtTogether,
} from "@/lib/repositories/products.repo";
import { getBrandById } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import { fromMinor, formatBDT } from "@/lib/money";
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
  const [related, fbt, brand] = await Promise.all([
    listRelatedProducts(String(product.categoryId), String(product._id)).catch(
      () => [],
    ),
    frequentlyBoughtTogether(String(product._id)).catch(() => []),
    product.brandId
      ? getBrandById(String(product.brandId)).catch(() => null)
      : Promise.resolve(null),
  ]);

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

  const trust = [
    { icon: BadgeCheck, label: t("trustGenuine") },
    { icon: ShieldCheck, label: t("trustWarranty") },
    { icon: Truck, label: t("trustDelivery") },
    { icon: Headset, label: t("trustSupport") },
  ];

  return (
    <section style={{ paddingBlock: "clamp(32px, 4vw, 64px)" }}>
      <JsonLd data={jsonLd} />
      <Container
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-10)" }}
      >
        <Breadcrumb
          items={[
            { label: nav("home"), href: "/" },
            { label: nav("instruments"), href: "/instruments" },
            { label: name },
          ]}
        />

        {/* Gallery + buy box */}
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 1fr",
            gap: "var(--s-10)",
            alignItems: "start",
          }}
        >
          <ProductGallery images={product.images} name={name} />

          <aside
            style={{
              position: "sticky",
              top: 96,
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-5)",
            }}
          >
            {brand && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-caption)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-eyebrow)",
                  color: "var(--color-brand-deep)",
                }}
              >
                {localize(brand.name, l)}
              </span>
            )}
            <h1
              style={{
                fontSize: "var(--fs-h2)",
                color: "var(--color-text-strong)",
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              {name}
            </h1>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-caption)",
                color: "var(--color-text-muted)",
              }}
            >
              {t("sku")}: {product.sku}
            </span>

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

            <AddToCart
              productId={String(product._id)}
              stockQty={product.stockQty}
            />

            {/* Trust badges */}
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                marginTop: "var(--s-2)",
                padding: "var(--s-4)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--s-4)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-lg)",
                background: "var(--color-surface)",
              }}
            >
              {trust.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: "var(--fs-body-sm)",
                    color: "var(--color-text)",
                  }}
                >
                  <Icon
                    size={20}
                    color="var(--color-brand)"
                    strokeWidth={1.75}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </aside>
        </div>

        {/* Content sections */}
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

        {/* Frequently bought together (real order co-occurrence) */}
        {fbt.length > 0 && (
          <Rail title={t("frequentlyBought")}>
            <CardGrid columns={4}>
              {fbt.map((p) => (
                <ProductCard key={String(p._id)} product={p} locale={l} />
              ))}
            </CardGrid>
          </Rail>
        )}

        {/* Related / you may also like */}
        {related.length > 0 && (
          <Rail title={t("youMayLike")}>
            <CardGrid columns={4}>
              {related.map((p) => (
                <ProductCard key={String(p._id)} product={p} locale={l} />
              ))}
            </CardGrid>
          </Rail>
        )}

        {/* Recently viewed (client, localStorage) */}
        <RecentlyViewed
          title={t("recentlyViewed")}
          current={{
            href: `/instruments/product/${slug}`,
            name,
            image: product.images[0],
            meta: formatBDT(product.priceMinor, l),
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
