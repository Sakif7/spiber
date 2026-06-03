import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { Placeholder } from "@/components/ui/placeholder";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";
import type { Locale } from "@/i18n/routing";
import type { Lean } from "@/lib/models/_shared";
import type { ISoftwareProduct } from "@/lib/models/softwareProduct";

export function SoftwareCard({
  product,
  locale,
}: {
  product: Lean<ISoftwareProduct>;
  locale: Locale;
}) {
  const t = useTranslations("systems");
  const tc = useTranslations("common");
  const title = localize(product.name, locale);
  const desc = product.description ? localize(product.description, locale) : "";
  const priceLabel =
    product.pricingModel === "quote"
      ? t("pricing.quote")
      : product.priceMinor
        ? formatBDT(product.priceMinor, locale)
        : t("pricing.free");

  return (
    <Link href={`/systems/product/${product.slug}`} className="block h-full">
      <CardContainer
        containerClassName="py-0 w-full h-full"
        className="h-full w-full"
      >
        <CardBody className="group/card relative flex h-full w-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-shadow duration-300 hover:shadow-[0_24px_60px_-20px_rgba(14,139,134,0.35)]">
          <CardItem
            as="h3"
            translateZ="50"
            className="line-clamp-2 w-full text-[17px] leading-snug font-semibold text-[var(--color-text-strong)]"
          >
            {title}
          </CardItem>

          <CardItem translateZ="80" className="mt-4 w-full">
            <div className="relative aspect-[16/9] w-full overflow-hidden border border-[var(--color-hairline)] bg-[var(--color-surface-2)]">
              {product.screenshots[0] ? (
                <Image
                  src={product.screenshots[0]}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover/card:scale-[1.05]"
                />
              ) : (
                <Placeholder
                  label={title}
                  tone="slate"
                  style={{ position: "absolute", inset: 0 }}
                />
              )}
              <span
                className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-surface) 90%, transparent)",
                  color: "var(--color-brand-deep)",
                }}
              >
                {t(`pricing.${product.pricingModel}`)}
              </span>
            </div>
          </CardItem>

          {desc && (
            <CardItem
              as="p"
              translateZ="30"
              className="mt-5 line-clamp-2 w-full text-[13.5px] leading-relaxed text-[var(--color-text-muted)]"
            >
              {desc}
            </CardItem>
          )}

          <CardItem
            translateZ="40"
            className="mt-auto flex w-full items-center justify-between gap-3 pt-5"
          >
            <strong className="font-bold text-[var(--color-brand-deep)] text-[var(--fs-h5)]">
              {priceLabel}
            </strong>
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
