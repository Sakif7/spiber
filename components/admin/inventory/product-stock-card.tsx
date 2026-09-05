import { Link } from "@/i18n/navigation";

/**
 * The "Stock" card on a product editor: the current balance (base, or per
 * variant) and where to change it. Stock itself is never edited here — every
 * change goes through Inventory so the movement ledger stays authoritative.
 */
export function ProductStockCard({
  productId,
  sku,
  stockQty,
  variants,
  tracked,
}: {
  productId: string;
  sku: string;
  stockQty: number;
  variants?: { sku: string; label: string; stockQty: number }[];
  tracked: boolean;
}) {
  const hasVariants = Boolean(variants && variants.length > 0);
  const total = hasVariants
    ? variants!.reduce((s, v) => s + (v.stockQty || 0), 0)
    : stockQty;
  const inventoryHref = `/admin/inventory?q=${encodeURIComponent(sku)}`;
  const historyHref = `/admin/inventory/movements?product=${productId}`;

  return (
    <section className="bg-card rounded-lg p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-foreground text-sm font-semibold">Stock</h2>
          <p className="text-muted-foreground text-xs">
            {tracked
              ? "Tracked — counts towards low-stock alerts."
              : "Not tracked (quotation-only) — no low-stock alerts."}
          </p>
        </div>
        <p className="font-mono text-2xl font-bold tabular-nums">{total}</p>
      </div>

      {hasVariants && (
        <ul className="divide-border/60 mt-3 divide-y text-[13px]">
          {variants!.slice(0, 12).map((v) => (
            <li
              key={v.sku}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <span className="min-w-0 truncate">
                {v.label}
                <span className="text-muted-foreground font-mono text-xs">
                  {" "}
                  · {v.sku}
                </span>
              </span>
              <span className="font-mono tabular-nums">{v.stockQty}</span>
            </li>
          ))}
          {variants!.length > 12 && (
            <li className="text-muted-foreground py-1.5 text-xs">
              … and {variants!.length - 12} more
            </li>
          )}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        <Link
          href={inventoryHref}
          className="text-primary font-medium hover:underline"
        >
          Adjust in Inventory
        </Link>
        <Link
          href={historyHref}
          className="text-primary font-medium hover:underline"
        >
          Movement history
        </Link>
      </div>
    </section>
  );
}
