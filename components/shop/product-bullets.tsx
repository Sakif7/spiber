import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";
import type { Lean } from "@/lib/models/_shared";
import type { IProduct } from "@/lib/models/product";

export type ProductBullet = { label: string; value: string };

/**
 * Ryans-style spec bullets for listing cards/rows: the product's own specs
 * first, then honest derived attributes (brand, category, SKU, availability)
 * as fillers so a card reaches ~5 lines whenever the data allows. Nothing is
 * invented — a spec-less, brand-less product simply shows fewer lines.
 */
export function buildProductBullets(
  product: Lean<IProduct>,
  locale: Locale,
  opts: {
    brandName?: string;
    categoryName?: string;
    labels: {
      brand: string;
      category: string;
      sku: string;
      availability: string;
      inStock: string;
      outOfStock: string;
    };
    max?: number;
  },
): ProductBullet[] {
  const max = opts.max ?? 6;
  const bullets: ProductBullet[] = [];

  for (const s of product.specs ?? []) {
    if (bullets.length >= max) break;
    const label = localize(s.key, locale);
    const value = localize(s.value, locale);
    if (label && value) bullets.push({ label, value });
  }

  const fillers: ProductBullet[] = [];
  if (opts.brandName)
    fillers.push({ label: opts.labels.brand, value: opts.brandName });
  if (opts.categoryName)
    fillers.push({ label: opts.labels.category, value: opts.categoryName });
  if (product.sku) fillers.push({ label: opts.labels.sku, value: product.sku });
  const stock =
    (product.variants?.length ?? 0) > 0
      ? product.variants.reduce(
          (s, v) => s + (Number(v.stockQty ?? 0) - Number(v.reservedQty ?? 0)),
          0,
        )
      : Number(product.stockQty ?? 0) - Number(product.reservedQty ?? 0);
  fillers.push({
    label: opts.labels.availability,
    value: stock > 0 ? opts.labels.inStock : opts.labels.outOfStock,
  });

  // Fillers only pad up to the 5-line target; real specs may run to `max`.
  for (const f of fillers) {
    if (bullets.length >= 5) break;
    // Don't duplicate a spec that already covers the same label.
    if (bullets.some((b) => b.label.toLowerCase() === f.label.toLowerCase()))
      continue;
    bullets.push(f);
  }

  return bullets.slice(0, max);
}

/** The rendered bullet list (shared by the grid card and the list row). */
export function SpecBullets({
  bullets,
  clampLines = 6,
}: {
  bullets: ProductBullet[];
  clampLines?: number;
}) {
  if (bullets.length === 0) return null;
  return (
    <ul
      style={{
        listStyle: "disc",
        margin: 0,
        padding: "2px 0 0 18px",
        display: "grid",
        gap: 3,
      }}
    >
      {bullets.slice(0, clampLines).map((b, i) => (
        <li
          key={i}
          style={{
            fontSize: "var(--fs-caption)",
            color: "var(--color-text-muted)",
            lineHeight: 1.45,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {b.label} - {b.value}
        </li>
      ))}
    </ul>
  );
}
