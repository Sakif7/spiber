import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import { PriceTag } from "./price-tag";
import { Placeholder } from "@/components/ui/placeholder";
import type { Locale } from "@/i18n/routing";
import type { Lean } from "@/lib/models/_shared";
import type { IProduct } from "@/lib/models/product";

export function ProductCard({
  product,
  locale,
}: {
  product: Lean<IProduct>;
  locale: Locale;
}) {
  const name = localize(product.name, locale);
  return (
    <Link
      href={`/instruments/product/${product.slug}`}
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
          aspectRatio: "4 / 3",
          position: "relative",
          background: "var(--color-surface-2)",
        }}
      >
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <Placeholder
            label={name}
            tone="teal"
            style={{ position: "absolute", inset: 0 }}
          />
        )}
      </div>
      <div
        style={{
          padding: "var(--s-4)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
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
          {name}
        </h3>
        <PriceTag
          minor={product.priceMinor}
          locale={locale}
          style={{ color: "var(--color-brand-deep)", fontWeight: 600 }}
        />
        {product.stockQty <= 0 && (
          <span
            style={{
              fontSize: "var(--fs-caption)",
              color: "var(--color-error)",
            }}
          >
            ●
          </span>
        )}
      </div>
    </Link>
  );
}
