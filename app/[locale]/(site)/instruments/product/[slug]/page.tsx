import { notFound } from "next/navigation";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CardGrid } from "@/components/ui/card-grid";
import { JsonLd } from "@/components/ui/json-ld";
import { Placeholder } from "@/components/ui/placeholder";
import { AddToCart } from "@/components/shop/add-to-cart";
import { ProductCard } from "@/components/shop/product-card";
import { PriceTag } from "@/components/shop/price-tag";
import {
  getProductBySlug,
  listRelatedProducts,
} from "@/lib/repositories/products.repo";
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
  const related = await listRelatedProducts(
    String(product.categoryId),
    String(product._id),
  ).catch(() => []);

  const stockLabel =
    product.stockQty <= 0
      ? t("outOfStock")
      : product.stockQty <= product.lowStockThreshold
        ? t("lowStock", { count: product.stockQty })
        : t("inStock");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    sku: product.sku,
    image: product.images,
    description: product.description
      ? localize(product.description, l)
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

  return (
    <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
      <JsonLd data={jsonLd} />
      <Container
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-8)" }}
      >
        <Breadcrumb
          items={[
            { label: nav("home"), href: "/" },
            { label: nav("instruments"), href: "/instruments" },
            { label: name },
          ]}
        />

        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--s-10)",
            alignItems: "start",
          }}
        >
          {/* Gallery */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-3)",
            }}
          >
            <div
              style={{
                position: "relative",
                aspectRatio: "1 / 1",
                borderRadius: "var(--r-xl)",
                overflow: "hidden",
                background: "var(--color-surface-2)",
              }}
            >
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={name}
                  fill
                  sizes="(max-width: 980px) 100vw, 50vw"
                  style={{ objectFit: "cover" }}
                  priority
                />
              ) : (
                <Placeholder
                  label={name}
                  tone="teal"
                  style={{ position: "absolute", inset: 0 }}
                />
              )}
            </div>
            {product.images.length > 1 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {product.images.slice(1, 5).map((img, i) => (
                  <div
                    key={i}
                    style={{
                      position: "relative",
                      width: 72,
                      height: 72,
                      borderRadius: "var(--r-sm)",
                      overflow: "hidden",
                      background: "var(--color-surface-2)",
                    }}
                  >
                    <Image
                      src={img}
                      alt={`${name} ${i + 2}`}
                      fill
                      sizes="72px"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-5)",
            }}
          >
            <h1
              style={{
                fontSize: "var(--fs-h2)",
                color: "var(--color-text-strong)",
                lineHeight: 1.15,
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
            <PriceTag
              minor={product.priceMinor}
              locale={l}
              style={{
                fontSize: "var(--fs-h3)",
                color: "var(--color-brand-deep)",
                fontWeight: 600,
              }}
            />
            <span
              style={{
                fontSize: "var(--fs-body-sm)",
                color:
                  product.stockQty > 0
                    ? "var(--color-success)"
                    : "var(--color-error)",
              }}
            >
              {stockLabel}
            </span>
            {product.description && (
              <p
                style={{
                  color: "var(--color-text-muted)",
                  lineHeight: "var(--lh-body)",
                }}
              >
                {localize(product.description, l)}
              </p>
            )}
            <AddToCart
              productId={String(product._id)}
              stockQty={product.stockQty}
            />
          </div>
        </div>

        {/* Specs */}
        {product.specs.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-4)",
              maxWidth: 720,
            }}
          >
            <h2
              style={{
                fontSize: "var(--fs-h4)",
                color: "var(--color-text-strong)",
              }}
            >
              {t("specifications")}
            </h2>
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
          </div>
        )}

        {/* Related */}
        {related.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-5)",
            }}
          >
            <h2
              style={{
                fontSize: "var(--fs-h4)",
                color: "var(--color-text-strong)",
              }}
            >
              {t("related")}
            </h2>
            <CardGrid columns={4}>
              {related.map((p) => (
                <ProductCard key={String(p._id)} product={p} locale={l} />
              ))}
            </CardGrid>
          </div>
        )}
      </Container>
    </section>
  );
}
