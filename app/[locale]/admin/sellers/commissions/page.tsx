import { setRequestLocale } from "next-intl/server";
import { listSellerCommissionsForAdmin } from "@/lib/repositories/seller-commissions.repo";
import { listSellers, sellerNamesByIds } from "@/lib/repositories/sellers.repo";
import { formatBDT } from "@/lib/money";
import {
  sellerCommissionStatusEnum,
  type SellerCommissionStatus,
} from "@/lib/schemas/seller-commission";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = sellerCommissionStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "order", "sales", "commission", "earnings", "status"],
  defaultSort: "date",
  filters: ["status", "seller", "from", "to"],
};

type Row = Awaited<
  ReturnType<typeof listSellerCommissionsForAdmin>
>["items"][number];

export default async function AdminSellerCommissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(
    query.filters.status as SellerCommissionStatus,
  )
    ? (query.filters.status as SellerCommissionStatus)
    : undefined;
  const sellerId = query.filters.seller || undefined;
  const filtered = Boolean(query.q || status || sellerId || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  let names: Record<string, string> = {};
  let sellerOptions: { value: string; label: string }[] = [];
  try {
    const [res, sellers] = await Promise.all([
      listSellerCommissionsForAdmin({
        status,
        sellerId,
        search: query.q || undefined,
        sort: query.sort,
        dir: query.dir,
        from: query.filters.from,
        to: query.filters.to,
        page: query.page,
        pageSize: query.pageSize,
      }),
      listSellers(),
    ]);
    rows = res.items;
    total = res.total;
    pages = res.pages;
    sellerOptions = sellers.map((s) => ({
      value: String(s._id),
      label: s.displayName,
    }));
    names = Object.fromEntries(sellerOptions.map((s) => [s.value, s.label]));
    if (rows.some((r) => !names[String(r.sellerId)])) {
      const extra = await sellerNamesByIds(
        rows.map((r) => String(r.sellerId)).filter(Boolean),
      ).catch(() => ({}));
      names = { ...extra, ...names };
    }
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "order",
      header: "Order",
      sortKey: "order",
      sortDir: "asc",
      className: "font-mono text-xs",
      cell: (r) => r.orderNumber,
    },
    {
      key: "seller",
      header: "Seller",
      cell: (r) => (
        <span className="text-muted-foreground">
          {names[String(r.sellerId)] ?? "—"}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Sales",
      align: "right",
      sortKey: "sales",
      className: "font-mono whitespace-nowrap",
      cell: (r) => formatBDT(r.itemSubtotalMinor, "en"),
    },
    {
      key: "commission",
      header: "Commission",
      align: "right",
      sortKey: "commission",
      className: "font-mono whitespace-nowrap",
      cell: (r) => formatBDT(r.commissionAmountMinor, "en"),
    },
    {
      key: "earnings",
      header: "Earnings",
      align: "right",
      sortKey: "earnings",
      className: "font-mono whitespace-nowrap",
      cell: (r) => formatBDT(r.sellerEarningsMinor, "en"),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (r) => <StatusBadge>{r.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      sortKey: "date",
      cell: (r) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(r.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Seller commissions"
        description="Seller earnings accrued from Spiber Kart orders, and the platform fee on each."
      />

      <ListToolbar
        search={{ placeholder: "Search order #…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
          ...(sellerOptions.length > 0
            ? [
                {
                  param: "seller",
                  label: "Seller",
                  kind: "select" as const,
                  options: sellerOptions,
                  allLabel: "All sellers",
                },
              ]
            : []),
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Date" },
            { value: "earnings", label: "Earnings" },
            { value: "commission", label: "Commission" },
            { value: "sales", label: "Sales" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "order", label: "Order #", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} commission${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No commissions match these filters."
            : "No commissions yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "A commission accrues when a Spiber Kart order containing seller items is marked paid."
        }
        minWidth={880}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="commissions"
      />
    </div>
  );
}
