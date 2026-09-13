import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listSellersForAdmin } from "@/lib/repositories/sellers.repo";
import { sellerStatusEnum, type SellerStatus } from "@/lib/schemas/seller";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions } from "@/components/admin/ui/row-actions";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = sellerStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "name", "status"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listSellersForAdmin>>["items"][number];

export default async function AdminSellersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as SellerStatus)
    ? (query.filters.status as SellerStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listSellersForAdmin({
      status,
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
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "displayName",
      header: "Seller",
      sortKey: "name",
      sortDir: "asc",
      cell: (s) => (
        <Link
          href={`/admin/sellers/${String(s._id)}`}
          className="text-primary font-medium hover:underline"
        >
          {s.displayName}
        </Link>
      ),
    },
    {
      key: "slug",
      header: "Storefront",
      cell: (s) => (
        <span className="text-muted-foreground font-mono text-xs">
          /kart/seller/{s.slug}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (s) => <StatusBadge>{s.status}</StatusBadge>,
    },
    {
      key: "commission",
      header: "Commission",
      cell: (s) => (
        <span className="text-muted-foreground">
          {s.commissionBp == null ? "Default" : `${s.commissionBp / 100}%`}
        </span>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      align: "right",
      sortKey: "date",
      cell: (s) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(s.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (s) => (
        <RowActions
          label={`Actions for ${s.displayName}`}
          actions={[
            {
              label: "Open seller",
              href: `/admin/sellers/${String(s._id)}`,
              icon: "view",
            },
            {
              label: "View storefront",
              href: `/kart/seller/${s.slug}`,
              icon: "open",
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Sellers"
        description="Spiber Kart marketplace sellers — status and commission overrides."
      />

      <ListToolbar
        search={{ placeholder: "Search seller name or slug…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Joined" },
            { value: "name", label: "Name", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} seller${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(s) => String(s._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={filtered ? "No sellers match these filters." : "No sellers yet."}
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "A seller profile is created automatically when you approve a seller application."
        }
        minWidth={760}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="sellers"
      />
    </div>
  );
}
