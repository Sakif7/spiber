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
      cell: (r) => {
        const isUpdate = r.approvalStatus === "approved" && !!r.pendingDraft;
        const draftName = r.pendingDraft
          ? localize(r.pendingDraft.name, locale as Locale)
          : null;
        const liveName = localize(r.name, locale as Locale);
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="truncate">{draftName ?? liveName}</span>
              <span
                className={
                  isUpdate
                    ? "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                    : "rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800"
                }
              >
                {isUpdate ? "Update" : "New listing"}
              </span>
            </span>
            {isUpdate && draftName !== liveName && (
              <span className="text-muted-foreground truncate text-xs">
                live: {liveName}
              </span>
            )}
          </div>
        );
      },
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
          {new Date(
            r.pendingDraft?.submittedAt ?? r.createdAt,
          ).toLocaleDateString()}
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
