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

export default async function AdminProductsPage({
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
      storefront: "instruments",
      search: query.q || undefined,
      status,
      sort: productSortFor(query),
      page: query.page,
      pageSize: query.pageSize,
    });
    total = res.total;
    pages = res.pages;
    rows = res.items.map((p) => ({
      id: String(p._id),
      name: localize(p.name, "en"),
      sku: p.sku,
      priceLabel:
        p.priceMinor != null ? formatBDT(p.priceMinor, "en") : "On request",
      stock: p.stockQty,
      // Quotation-only products carry no stock, so they are never "low".
      lowStock: p.priceMinor != null && p.stockQty <= p.lowStockThreshold,
      status: p.status,
      featured: false,
    }));
  } catch {
    rows = [];
  }

  return (
    <ProductsManager
      storefront="instruments"
      title="Medtrade products"
      description="Catalog for quotations and, when priced, direct purchase."
      basePath="/admin/products"
      newHref="/admin/products/new"
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
