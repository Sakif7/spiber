import { useTranslations } from "next-intl";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { PriceTag } from "./price-tag";
import { WishlistButton } from "./wishlist-button";
import { buildProductBullets, SpecBullets } from "./product-bullets";
import { RatingStars } from "@/components/marketplace/rating-stars";
import { CatalogCard } from "@/components/ui/catalog-card";
import type { Locale } from "@/i18n/routing";
import type { Lean } from "@/lib/models/_shared";
import type { IProduct } from "@/lib/models/product";

type CardMode = "instruments" | "marketplace";

// CATEGORY EYEBROW — added 2026-06-06. The leaf category is shown as the mono
// eyebrow above the brand on product cards. Flip this to `false` (one edit) to
// hide it everywhere; the brand line below is unaffected. Callers may keep
// passing `categoryName` harmlessly.
const SHOW_CATEGORY_EYEBROW = true;

/** Lowest resolvable price across variants, or the base price. */
function effectivePrice(product: Lean<IProduct>): {
  price: number | null;
  from: boolean;
} {
  const variants = product.variants ?? [];
  if (variants.length === 0) return { price: product.priceMinor, from: false };
  const prices = variants
    .map((v) => v.priceMinorOverride ?? product.priceMinor)
    .filter((n): n is number => n != null);
  if (prices.length === 0) return { price: product.priceMinor, from: false };
  return { price: Math.min(...prices), from: new Set(prices).size > 1 };
}

function effectiveStock(product: Lean<IProduct>): number {
  const variants = product.variants ?? [];
  if (variants.length === 0) return product.stockQty;
  return variants.reduce((s, v) => s + v.stockQty, 0);
}

export function ProductCard({
  product,
  locale,
  brandName,
  categoryName,
  wishlisted = false,
  mode = "marketplace",
  showSpecs = false,
}: {
  product: Lean<IProduct>;
  locale: Locale;
  brandName?: string;
  /** Leaf category name, shown as the mono eyebrow above the brand. */
  categoryName?: string;
  wishlisted?: boolean;
  mode?: CardMode;
  /** Listing surfaces: render ~5 spec bullets under the title (Ryans-style). */
  showSpecs?: boolean;
}) {
  const t = useTranslations("shop.product");
  const tc = useTranslations("common");
  const tq = useTranslations("quotation");
  const name = localize(product.name, locale);
  const isInstruments = mode === "instruments";
  const href = isInstruments
    ? `/medtrade/product/${product.slug}`
    : `/kart/product/${product.slug}`;

  const { price, from } = effectivePrice(product);
  const stock = effectiveStock(product);
  const out = !isInstruments && stock <= 0;
  const low = !isInstruments && !out && stock <= product.lowStockThreshold;
  const showRating = !isInstruments && product.ratingCount > 0;

  // Discount: admin-set "compare-at" (was) price above the current price.
  const compareAt = product.compareAtMinor ?? null;
  const onSale =
    !isInstruments && price != null && compareAt != null && compareAt > price;
  const pct = onSale ? Math.round((1 - price / compareAt) * 100) : 0;

  const bullets = showSpecs
    ? buildProductBullets(product, locale, {
        brandName,
        categoryName,
        labels: {
          brand: t("brand"),
          category: t("bulletCategory"),
          sku: t("sku"),
          availability: t("bulletAvailability"),
          inStock: t("inStock"),
          outOfStock: t("outOfStock"),
        },
      })
    : [];

  return (
    <CatalogCard
      href={href}
      image={product.images[0]}
      imageAlt={name}
      placeholderLabel={name}
      placeholderTone="teal"
      imageTopLeft={
        onSale || out || low ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              alignItems: "flex-start",
            }}
          >
            {onSale && (
              <span
                style={{
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".02em",
                  color: "#fff",
                  background: "var(--color-secondary)",
                  boxShadow: "0 4px 12px -4px rgba(10,31,44,.35)",
                }}
              >
                -{pct}%
              </span>
            )}
            {(out || low) && (
              <span
                style={{
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  backdropFilter: "blur(4px)",
                  background:
                    "color-mix(in srgb, var(--color-surface) 92%, transparent)",
                  color: out
                    ? "var(--color-error)"
                    : "var(--color-secondary-deep)",
                }}
              >
                {out ? t("outOfStock") : t("lowStock", { count: stock })}
              </span>
            )}
          </div>
        ) : undefined
      }
      // NOTE: in dev, React 19 logs a spurious 'unique "key"' warning
      // ("CatalogCard … child from ProductCard") on the medtrade detail rail.
      // Empirically pinned to this client-component slot crossing the RSC
      // boundary; every real list here is keyed, and no keying strategy
      // (element key, host wrapper, keyed siblings) silences it. Dev-only —
      // production builds strip key validation entirely.
      imageTopRight={
        <WishlistButton
          productId={String(product._id)}
          initialWishlisted={wishlisted}
        />
      }
      topLabel={SHOW_CATEGORY_EYEBROW ? categoryName || undefined : undefined}
      subLabel={
        brandName ? (
          <span
            style={{
              fontSize: "var(--fs-micro)",
              fontWeight: 500,
              color: "var(--color-text-muted)",
            }}
          >
            {brandName}
          </span>
        ) : undefined
      }
      title={name}
      belowTitle={
        showRating ? (
          <RatingStars value={product.ratingAvg} count={product.ratingCount} />
        ) : undefined
      }
      details={
        showSpecs && bullets.length > 0 ? (
          <SpecBullets bullets={bullets} />
        ) : undefined
      }
      footerLeft={
        isInstruments ? (
          <span
            style={{
              fontSize: "var(--fs-caption)",
              color: "var(--color-text-muted)",
              fontWeight: 600,
            }}
          >
            {tq("priceOnRequest")}
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <PriceTag
              minor={price}
              locale={locale}
              prefix={from ? tc("from") : undefined}
              fallback={tq("priceOnRequest")}
              style={{
                fontSize: "var(--fs-h5)",
                color: "var(--color-brand-deep)",
                fontWeight: 700,
              }}
            />
            {onSale && (
              <span
                style={{
                  fontSize: "var(--fs-caption)",
                  color: "var(--color-text-subtle)",
                  textDecoration: "line-through",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatBDT(compareAt, locale)}
              </span>
            )}
          </span>
        )
      }
      action={isInstruments ? tq("requestQuotationShort") : tc("view")}
    />
  );
}
