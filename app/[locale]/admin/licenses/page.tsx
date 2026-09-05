import { setRequestLocale } from "next-intl/server";
import { listLicensesForAdmin } from "@/lib/repositories/licenses.repo";
import { licenseStatusEnum, type LicenseStatus } from "@/lib/schemas/systems";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { StatusRowActions } from "@/components/admin/status-row-actions";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = licenseStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "issued", "status", "key"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listLicensesForAdmin>>["items"][number];

export default async function AdminLicensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as LicenseStatus)
    ? (query.filters.status as LicenseStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listLicensesForAdmin({
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
      key: "key",
      header: "Key",
      sortKey: "key",
      sortDir: "asc",
      cell: (lic) => (
        <span className="font-mono text-xs font-medium">{lic.key}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (lic) => <StatusBadge>{lic.status}</StatusBadge>,
    },
    {
      key: "issued",
      header: "Issued",
      sortKey: "issued",
      cell: (lic) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(lic.issuedAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      cell: (lic) => (
        <StatusRowActions
          endpoint={`/api/admin/licenses/${String(lic._id)}`}
          actions={
            lic.status === "revoked"
              ? [{ to: "active", label: "Reactivate" }]
              : [{ to: "revoked", label: "Revoke", danger: true }]
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Licenses"
        description="Issued software license keys — reactivate or revoke access."
      />

      <ListToolbar
        search={{ placeholder: "Search license key…" }}
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
            { value: "date", label: "Created" },
            { value: "issued", label: "Issued" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "key", label: "Key", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} license${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(lic) => String(lic._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No licenses match these filters."
            : "No licenses issued yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "A key is issued automatically when a license-delivered software purchase is marked paid."
        }
        minWidth={640}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="licenses"
      />
    </div>
  );
}
