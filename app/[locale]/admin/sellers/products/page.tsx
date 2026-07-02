import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { listPendingSellerProducts } from "@/lib/repositories/products.repo";
import { sellerNamesByIds } from "@/lib/repositories/sellers.repo";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { ProductApprovalActions } from "@/components/admin/product-approval-actions";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listPendingSellerProducts>>[number];

export default async function AdminSellerProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = await listPendingSellerProducts();
  } catch {
    rows = [];
  }

  let names: Record<string, string> = {};
  try {
    names = await sellerNamesByIds(
      rows.map((r) => (r.sellerId ? String(r.sellerId) : "")).filter(Boolean),
    );
  } catch {
    names = {};
  }

  const columns: Column<Row>[] = [
    {
      key: "product",
      header: "Product",
      cell: (r) => localize(r.name, locale as Locale),
    },
    {
      key: "seller",
      header: "Seller",
      cell: (r) => (
        <span className="text-muted-foreground">
          {(r.sellerId && names[String(r.sellerId)]) ?? "—"}
        </span>
      ),
    },
    {
      key: "price",
      header: "Price",
      className: "font-mono whitespace-nowrap",
      cell: (r) => (r.priceMinor != null ? formatBDT(r.priceMinor) : "—"),
    },
    {
      key: "submitted",
      header: "Submitted",
      cell: (r) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (r) => <ProductApprovalActions productId={String(r._id)} />,
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Pending products"
        description="Seller listings awaiting approval."
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        empty="No products awaiting approval."
        minWidth={760}
      />
    </div>
  );
}
