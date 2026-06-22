import { setRequestLocale } from "next-intl/server";
import {
  ProductsManager,
  type ProductManagerRow,
} from "@/components/admin/products-manager";
import { listProducts } from "@/lib/repositories/products.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import type { ProductStatus } from "@/lib/schemas/catalog";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "active", "archived"];

export default async function AdminProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q : "";
  const status =
    typeof sp.status === "string" && STATUSES.includes(sp.status)
      ? (sp.status as ProductStatus)
      : undefined;
  const page = Math.max(
    1,
    parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1,
  );

  let rows: ProductManagerRow[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listProducts({
      storefront: "instruments",
      search: q || undefined,
      status,
      page,
      pageSize: 60,
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
      lowStock: p.stockQty <= p.lowStockThreshold,
      status: p.status,
      featured: false,
    }));
  } catch {
    rows = [];
  }

  return (
    <ProductsManager
      storefront="instruments"
      title="Products"
      basePath="/admin/products"
      newHref="/admin/products/new"
      rows={rows}
      total={total}
      page={page}
      pages={pages}
      q={q}
      status={status ?? ""}
    />
  );
}
