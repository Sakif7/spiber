import { setRequestLocale } from "next-intl/server";
import {
  ProductsManager,
  type ProductManagerRow,
} from "@/components/admin/products-manager";
import { listProducts } from "@/lib/repositories/products.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import type { ProductStatus } from "@/lib/schemas/catalog";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { productSortFor } from "@/lib/admin/product-sort";

export const dynamic = "force-dynamic";

const STATUSES: ProductStatus[] = ["draft", "active", "archived"];

const LIST: ListConfig = {
  sortable: ["date", "name", "price"],
  defaultSort: "date",
  filters: ["status"],
};

export default async function AdminMarketplaceProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as ProductStatus)
    ? (query.filters.status as ProductStatus)
    : undefined;

  let rows: ProductManagerRow[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listProducts({
      storefront: "marketplace",
      search: query.q || undefined,
      status,
      sort: productSortFor(query),
      page: query.page,
      pageSize: query.pageSize,
    });
    total = res.total;
    pages = res.pages;
    rows = res.items.map((p) => {
      const hasVariants = (p.variants?.length ?? 0) > 0;
      const stock = hasVariants
        ? p.variants.reduce((s, v) => s + v.stockQty, 0)
        : p.stockQty;
      return {
        id: String(p._id),
        name: localize(p.name, "en"),
        sku: p.sku,
        priceLabel: hasVariants
          ? "Varies"
          : p.priceMinor != null
            ? formatBDT(p.priceMinor, "en")
            : "—",
        stock,
        lowStock: stock <= p.lowStockThreshold,
        status: p.status,
        featured: p.featured,
      };
    });
  } catch {
    rows = [];
  }

  return (
    <ProductsManager
      storefront="marketplace"
      title="Spiber Kart products"
      description="House catalog for the Spiber Kart storefront."
      basePath="/admin/marketplace/products"
      newHref="/admin/marketplace/products/new"
      rows={rows}
      total={total}
      page={query.page}
      pages={pages}
      pageSize={query.pageSize}
      q={query.q}
      status={status ?? ""}
      sort={{ key: query.sort, dir: query.dir }}
    />
  );
}
