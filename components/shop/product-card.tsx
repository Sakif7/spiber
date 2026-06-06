import { useTranslations } from "next-intl";
import { localize } from "@/lib/schemas/localized";
import { PriceTag } from "./price-tag";
import { WishlistButton } from "./wishlist-button";
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
}: {
  product: Lean<IProduct>;
  locale: Locale;
  brandName?: string;
  /** Leaf category name, shown as the mono eyebrow above the brand. */
  categoryName?: string;
  wishlisted?: boolean;
  mode?: CardMode;
}) {
  const t = useTranslations("shop.product");
  const tc = useTranslations("common");
  const tq = useTranslations("quotation");
  const name = localize(product.name, locale);
  const isInstruments = mode === "instruments";
  const href = isInstruments
    ? `/instruments/product/${product.slug}`
    : `/marketplace/product/${product.slug}`;

  const { price, from } = effectivePrice(product);
  const stock = effectiveStock(product);
  const out = !isInstruments && stock <= 0;
  const low = !isInstruments && !out && stock <= product.lowStockThreshold;
  const showRating = !isInstruments && product.ratingCount > 0;

  return (
    <CatalogCard
      href={href}
      image={product.images[0]}
      imageAlt={name}
      placeholderLabel={name}
      placeholderTone="teal"
      imageTopLeft={
        out || low ? (
          <span
            style={{
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              backdropFilter: "blur(4px)",
              background:
                "color-mix(in srgb, var(--color-surface) 92%, transparent)",
              color: out ? "var(--color-error)" : "var(--color-secondary-deep)",
            }}
          >
            {out ? t("outOfStock") : t("lowStock", { count: stock })}
          </span>
        ) : undefined
      }
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
        )
      }
      action={isInstruments ? tq("requestQuotationShort") : tc("view")}
    />
  );
}
