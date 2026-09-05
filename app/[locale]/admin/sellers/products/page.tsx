import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPendingSellerProductsForAdmin } from "@/lib/repositories/products.repo";
import { sellerNamesByIds } from "@/lib/repositories/sellers.repo";
import { formatBDT } from "@/lib/money";
import { asLocale } from "@/lib/i18n/intl-locale";
import { localize } from "@/lib/schemas/localized";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { ProductApprovalActions } from "@/components/admin/product-approval-actions";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  sortable: ["date", "name", "price"],
  defaultSort: "date",
  defaultDir: "asc",
  filters: ["kind", "from", "to"],
};

type Row = Awaited<
  ReturnType<typeof listPendingSellerProductsForAdmin>
>["items"][number];

export default async function AdminSellerProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = asLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const kind =
    query.filters.kind === "new" || query.filters.kind === "update"
      ? query.filters.kind
      : undefined;
  const filtered = Boolean(query.q || kind || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  let names: Record<string, string> = {};
  try {
    const res = await listPendingSellerProductsForAdmin({
      kind,
      search: query.q || undefined,
      sort: query.sort,
      dir: query.dir,
      from: query.filters.from,
      to: query.filters.to,
      page: query.page,
      pageSize: query.pageSize,
    });
    rows = res.items;
    total = res.total;
    pages = res.pages;
    names = await sellerNamesByIds(
      rows.map((r) => (r.sellerId ? String(r.sellerId) : "")).filter(Boolean),
    ).catch(() => ({}));
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "product",
      header: "Product",
      sortKey: "name",
      sortDir: "asc",
      cell: (r) => {
        const isUpdate = r.approvalStatus === "approved" && !!r.pendingDraft;
        const draftName = r.pendingDraft
          ? localize(r.pendingDraft.name, l)
          : null;
        const liveName = localize(r.name, l);
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <Link
                href={`/admin/marketplace/products/${String(r._id)}`}
                className="text-primary truncate font-medium hover:underline"
              >
                {draftName ?? liveName}
              </Link>
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
      key: "sku",
      header: "SKU",
      cell: (r) => (
        <span className="text-muted-foreground font-mono text-xs">{r.sku}</span>
      ),
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
      align: "right",
      sortKey: "price",
      className: "font-mono whitespace-nowrap",
      cell: (r) => (r.priceMinor != null ? formatBDT(r.priceMinor, "en") : "—"),
    },
    {
      key: "submitted",
      header: "Submitted",
      sortKey: "date",
      sortDir: "asc",
      cell: (r) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(
            r.pendingDraft?.submittedAt ?? r.createdAt,
          ).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Review",
      align: "right",
      mobile: "actions",
      cell: (r) => <ProductApprovalActions productId={String(r._id)} />,
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Pending seller products"
        description="Seller listings awaiting approval — new listings and edits to live ones."
      />

      <ListToolbar
        search={{ placeholder: "Search product name or SKU…" }}
        filters={[
          {
            param: "kind",
            label: "Kind",
            kind: "pills",
            options: [
              { value: "new", label: "New listings" },
              { value: "update", label: "Updates" },
            ],
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Submitted", defaultDir: "asc" },
            { value: "name", label: "Name", defaultDir: "asc" },
            { value: "price", label: "Price" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} awaiting review`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No pending products match these filters."
            : "No products awaiting approval."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Seller listings land here when they are created, and again when an approved listing's content is edited."
        }
        minWidth={820}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="products"
      />
    </div>
  );
}
