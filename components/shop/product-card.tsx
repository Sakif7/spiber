import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import { PriceTag } from "./price-tag";
import { WishlistButton } from "./wishlist-button";
import { RatingStars } from "@/components/marketplace/rating-stars";
import { Placeholder } from "@/components/ui/placeholder";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";
import type { Locale } from "@/i18n/routing";
import type { Lean } from "@/lib/models/_shared";
import type { IProduct } from "@/lib/models/product";

type CardMode = "instruments" | "marketplace";

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
  wishlisted = false,
  mode = "marketplace",
}: {
  product: Lean<IProduct>;
  locale: Locale;
  brandName?: string;
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

  const tealShadow = "hover:shadow-[0_24px_60px_-20px_rgba(14,139,134,0.35)]";

  return (
    <Link href={href} className="block h-full">
      <CardContainer
        containerClassName="py-0 w-full h-full"
        className="h-full w-full"
      >
        <CardBody
          className={`group/card relative flex h-full w-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow duration-300 ${tealShadow}`}
        >
          {/* Image */}
          <CardItem translateZ="70" className="w-full">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-2)]">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover/card:scale-[1.05]"
                />
              ) : (
                <Placeholder
                  label={name}
                  tone="teal"
                  style={{ position: "absolute", inset: 0 }}
                />
              )}
            </div>
          </CardItem>

          {/* Stock pill (marketplace only) */}
          {(out || low) && (
            <CardItem
              translateZ="100"
              className="absolute top-7 left-7 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur"
              style={{
                background:
                  "color-mix(in srgb, var(--color-surface) 92%, transparent)",
                color: out
                  ? "var(--color-error)"
                  : "var(--color-secondary-deep)",
              }}
            >
              {out ? t("outOfStock") : t("lowStock", { count: stock })}
            </CardItem>
          )}

          {/* Wishlist heart */}
          <CardItem translateZ="100" className="absolute top-7 right-7 z-10">
            <WishlistButton
              productId={String(product._id)}
              initialWishlisted={wishlisted}
            />
          </CardItem>

          {/* Brand */}
          {brandName && (
            <CardItem
              as="span"
              translateZ="30"
              className="mt-4 w-full text-[length:var(--fs-micro)] font-medium text-[color:var(--color-text-muted)]"
            >
              {brandName}
            </CardItem>
          )}

          {/* Title */}
          <CardItem
            as="h3"
            translateZ="40"
            className={`${brandName ? "mt-1" : "mt-4"} line-clamp-2 w-full text-[15px] leading-snug font-semibold text-[var(--color-text-strong)]`}
          >
            {name}
          </CardItem>

          {/* Rating (marketplace) */}
          {showRating && (
            <CardItem translateZ="30" className="mt-2 w-full">
              <RatingStars
                value={product.ratingAvg}
                count={product.ratingCount}
              />
            </CardItem>
          )}

          {/* Price + CTA. Instruments stacks (no price → avoids a cramped
              side-by-side wrap); marketplace puts price + View on one row. */}
          {isInstruments ? (
            <CardItem
              translateZ="40"
              className="mt-auto flex w-full flex-col items-start gap-2.5 pt-4"
            >
              <span
                style={{
                  fontSize: "var(--fs-caption)",
                  color: "var(--color-text-muted)",
                  fontWeight: 600,
                }}
              >
                {tq("priceOnRequest")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-brand-deep)] transition-colors group-hover/card:border-[var(--color-brand)] group-hover/card:bg-[var(--color-brand)] group-hover/card:text-white">
                {tq("requestQuotationShort")}
                <span aria-hidden>→</span>
              </span>
            </CardItem>
          ) : (
            <CardItem
              translateZ="40"
              className="mt-auto flex w-full items-center justify-between gap-3 pt-4"
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
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-brand-deep)] transition-colors group-hover/card:border-[var(--color-brand)] group-hover/card:bg-[var(--color-brand)] group-hover/card:text-white">
                {tc("view")}
                <span aria-hidden>→</span>
              </span>
            </CardItem>
          )}
        </CardBody>
      </CardContainer>
    </Link>
  );
}
