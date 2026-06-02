import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { Placeholder } from "@/components/ui/placeholder";
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
  const title = localize(product.name, locale);
  const priceLabel =
    product.pricingModel === "quote"
      ? t("pricing.quote")
      : product.priceMinor
        ? formatBDT(product.priceMinor, locale)
        : t("pricing.free");

  return (
    <Link
      href={`/systems/product/${product.slug}`}
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        background: "var(--color-surface)",
        transition:
          "box-shadow 220ms var(--ease-out-expo), transform 220ms var(--ease-out-expo)",
      }}
    >
      <div
        style={{
          aspectRatio: "16 / 9",
          position: "relative",
          background: "var(--color-surface-2)",
        }}
      >
        {product.screenshots[0] ? (
          <Image
            src={product.screenshots[0]}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <Placeholder
            label={title}
            tone="slate"
            style={{ position: "absolute", inset: 0 }}
          />
        )}
        <span
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            padding: "4px 10px",
            borderRadius: "var(--r-pill)",
            background:
              "color-mix(in srgb, var(--color-surface) 88%, transparent)",
            fontSize: "var(--fs-caption)",
            fontWeight: 600,
            color: "var(--color-brand-deep)",
          }}
        >
          {t(`pricing.${product.pricingModel}`)}
        </span>
      </div>
      <div
        style={{
          padding: "var(--s-4)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <h3
          style={{
            fontSize: "var(--fs-body)",
            fontWeight: 600,
            color: "var(--color-text-strong)",
            lineHeight: 1.3,
          }}
        >
          {title}
        </h3>
        <strong style={{ color: "var(--color-brand-deep)", fontWeight: 700 }}>
          {priceLabel}
        </strong>
      </div>
    </Link>
  );
}
