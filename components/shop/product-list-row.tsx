import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { PriceTag } from "./price-tag";
import { buildProductBullets, SpecBullets } from "./product-bullets";
import { RatingStars } from "@/components/marketplace/rating-stars";
import { Placeholder } from "@/components/ui/placeholder";
import type { Locale } from "@/i18n/routing";
import type { Lean } from "@/lib/models/_shared";
import type { IProduct } from "@/lib/models/product";

/**
 * List-view row for the listing pages (the ☰ side of the view toggle):
 * image left, title + spec bullets centre, price + CTA right. Same data and
 * link target as the grid card, laid out horizontally.
 */
export function ProductListRow({
  product,
  locale,
  brandName,
  categoryName,
  mode = "marketplace",
}: {
  product: Lean<IProduct>;
  locale: Locale;
  brandName?: string;
  categoryName?: string;
  mode?: "instruments" | "marketplace";
}) {
  const t = useTranslations("shop.product");
  const tc = useTranslations("common");
  const tq = useTranslations("quotation");
  const name = localize(product.name, locale);
  const isInstruments = mode === "instruments";
  const href = isInstruments
    ? `/medtrade/product/${product.slug}`
    : `/kart/product/${product.slug}`;

  const variants = product.variants ?? [];
  const prices =
    variants.length > 0
      ? variants
          .map((v) => v.priceMinorOverride ?? product.priceMinor)
          .filter((n): n is number => n != null)
      : product.priceMinor != null
        ? [product.priceMinor]
        : [];
  const price = prices.length ? Math.min(...prices) : null;
  const from = new Set(prices).size > 1;
  const compareAt = product.compareAtMinor ?? null;
  const onSale =
    !isInstruments && price != null && compareAt != null && compareAt > price;

  const bullets = buildProductBullets(product, locale, {
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
    max: 7,
  });

  return (
    <Link
      href={href}
      className="plr-row"
      style={{
        display: "flex",
        gap: "var(--s-5)",
        alignItems: "stretch",
        border: "1px solid var(--teal-100)",
        borderRadius: "var(--r-lg)",
        background: "var(--color-surface)",
        padding: "var(--s-4)",
        textDecoration: "none",
        color: "inherit",
        boxShadow: "var(--shadow-xs)",
        transition: "box-shadow 200ms, border-color 200ms",
      }}
    >
      <div
        className="plr-media"
        style={{
          position: "relative",
          width: 180,
          minHeight: 140,
          flexShrink: 0,
          borderRadius: "var(--r-md)",
          overflow: "hidden",
          alignSelf: "center",
        }}
      >
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={name}
            fill
            sizes="180px"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <Placeholder
            label={name}
            tone="teal"
            style={{ width: "100%", height: "100%", position: "absolute" }}
          />
        )}
      </div>

      <div style={{ display: "grid", gap: 6, minWidth: 0, flex: 1 }}>
        {categoryName && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
            }}
          >
            {categoryName}
          </span>
        )}
        <strong
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-h5)",
            fontWeight: 600,
            color: "var(--color-text-strong)",
            letterSpacing: "-.01em",
          }}
        >
          {name}
        </strong>
        {!isInstruments && product.ratingCount > 0 && (
          <RatingStars value={product.ratingAvg} count={product.ratingCount} />
        )}
        <SpecBullets bullets={bullets} clampLines={7} />
      </div>

      <div
        className="plr-side"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-end",
          gap: 8,
          flexShrink: 0,
          paddingLeft: "var(--s-4)",
          borderLeft: "1px solid var(--color-hairline)",
          minWidth: 150,
        }}
      >
        {isInstruments ? (
          <span
            style={{
              fontSize: "var(--fs-body-sm)",
              color: "var(--color-text-muted)",
              fontWeight: 600,
              textAlign: "right",
            }}
          >
            {tq("priceOnRequest")}
          </span>
        ) : (
          <span
            style={{
              display: "grid",
              gap: 2,
              justifyItems: "end",
              textAlign: "right",
            }}
          >
            <PriceTag
              minor={price}
              locale={locale}
              prefix={from ? tc("from") : undefined}
              fallback={tq("priceOnRequest")}
              style={{
                fontSize: "var(--fs-h4)",
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
        )}
        <span
          style={{
            padding: "8px 18px",
            borderRadius: "var(--r-pill)",
            background: "var(--color-brand)",
            color: "#fff",
            fontSize: "var(--fs-body-sm)",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {isInstruments ? tq("requestQuotationShort") : tc("view")}
        </span>
      </div>
    </Link>
  );
}
