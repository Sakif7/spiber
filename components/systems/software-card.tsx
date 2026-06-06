import { useTranslations } from "next-intl";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { CatalogCard } from "@/components/ui/catalog-card";
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
  const priceLabel =
    product.pricingModel === "quote"
      ? t("pricing.quote")
      : product.priceMinor
        ? formatBDT(product.priceMinor, locale)
        : t("pricing.free");

  return (
    <CatalogCard
      href={`/systems/product/${product.slug}`}
      image={product.screenshots[0]}
      imageAlt={title}
      placeholderLabel={title}
      placeholderTone="slate"
      topLabel={t(`pricing.${product.pricingModel}`)}
      title={title}
      footerLeft={
        <strong
          style={{
            fontSize: "var(--fs-h5)",
            fontWeight: 700,
            color: "var(--color-brand-deep)",
          }}
        >
          {priceLabel}
        </strong>
      }
      action={tc("view")}
    />
  );
}
