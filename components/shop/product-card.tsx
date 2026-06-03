import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import { PriceTag } from "./price-tag";
import { WishlistButton } from "./wishlist-button";
import { Placeholder } from "@/components/ui/placeholder";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";
import type { Locale } from "@/i18n/routing";
import type { Lean } from "@/lib/models/_shared";
import type { IProduct } from "@/lib/models/product";

export function ProductCard({
  product,
  locale,
  brandName,
  wishlisted = false,
}: {
  product: Lean<IProduct>;
  locale: Locale;
  brandName?: string;
  wishlisted?: boolean;
}) {
  const t = useTranslations("shop.product");
  const tc = useTranslations("common");
  const name = localize(product.name, locale);
  const out = product.stockQty <= 0;
  const low = !out && product.stockQty <= product.lowStockThreshold;

  return (
    <Link
      href={`/instruments/product/${product.slug}`}
      className="block h-full"
    >
      <CardContainer
        containerClassName="py-0 w-full h-full"
        className="h-full w-full"
      >
        <CardBody className="group/card relative flex h-full w-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow duration-300 hover:shadow-[0_24px_60px_-20px_rgba(14,139,134,0.35)]">
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

          {/* Stock pill (out → red, low → orange) */}
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
              {out
                ? t("outOfStock")
                : t("lowStock", { count: product.stockQty })}
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
              className="mt-4 w-full font-medium text-[var(--color-text-muted)] text-[var(--fs-caption)]"
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

          {/* Price + CTA */}
          <CardItem
            translateZ="40"
            className="mt-auto flex w-full items-center justify-between gap-3 pt-4"
          >
            <PriceTag
              minor={product.priceMinor}
              locale={locale}
              style={{
                fontSize: "var(--fs-h5)",
                color: "var(--color-brand-deep)",
                fontWeight: 700,
              }}
            />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-brand-deep)] transition-colors group-hover/card:border-[var(--color-brand)] group-hover/card:bg-[var(--color-brand)] group-hover/card:text-white">
              {tc("view")}
              <span aria-hidden>→</span>
            </span>
          </CardItem>
        </CardBody>
      </CardContainer>
    </Link>
  );
}
