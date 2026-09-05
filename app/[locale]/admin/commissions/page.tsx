import { setRequestLocale } from "next-intl/server";
import {
  commissionTotals,
  listCommissionsForAdmin,
} from "@/lib/repositories/commissions.repo";
import { formatBDT } from "@/lib/money";
import {
  commissionStatusEnum,
  type CommissionStatus,
} from "@/lib/schemas/systems";
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

const STATUSES = commissionStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "accrued", "amount", "status", "app"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listCommissionsForAdmin>>["items"][number];

export default async function AdminCommissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as CommissionStatus)
    ? (query.filters.status as CommissionStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  let totals = { accruedMinor: 0, paidMinor: 0, voidMinor: 0 };
  try {
    const [res, t] = await Promise.all([
      listCommissionsForAdmin({
        status,
        search: query.q || undefined,
        sort: query.sort,
        dir: query.dir,
        from: query.filters.from,
        to: query.filters.to,
        page: query.page,
        pageSize: query.pageSize,
      }),
      commissionTotals(),
    ]);
    rows = res.items;
    total = res.total;
    pages = res.pages;
    totals = t;
  } catch {
    rows = [];
  }

  const summary = [
    { label: "Accrued", value: totals.accruedMinor },
    { label: "Paid", value: totals.paidMinor },
    { label: "Void", value: totals.voidMinor },
  ];

  const columns: Column<Row>[] = [
    {
      key: "app",
      header: "App",
      sortKey: "app",
      sortDir: "asc",
      cell: (c) => c.externalApp,
    },
    {
      key: "base",
      header: "Base",
      align: "right",
      cell: (c) => (
        <span className="text-muted-foreground">
          {formatBDT(c.basePriceMinor, "en")}
        </span>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      cell: (c) => (
        <span className="text-muted-foreground">
          {(c.rateBp / 100).toFixed(2)}%
        </span>
      ),
    },
    {
      key: "commission",
      header: "Commission",
      align: "right",
      sortKey: "amount",
      cell: (c) => (
        <span className="font-medium">{formatBDT(c.amountMinor, "en")}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (c) => <StatusBadge>{c.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Accrued",
      align: "right",
      sortKey: "accrued",
      cell: (c) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(c.accruedAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Affiliate commissions"
        description="Owner commission ledger for external-app provisioning — accrued, paid, and voided."
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        {summary.map((s) => (
          <div
            key={s.label}
            className="bg-card grid gap-0.5 rounded-lg p-4 shadow-[var(--shadow-sm)]"
          >
            <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.12em] uppercase">
              {s.label}
            </span>
            <strong className="text-foreground text-xl font-semibold tabular-nums">
              {formatBDT(s.value, "en")}
            </strong>
          </div>
        ))}
      </div>

      <ListToolbar
        search={{ placeholder: "Search external app…" }}
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
            { value: "accrued", label: "Accrued date" },
            { value: "amount", label: "Commission" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "app", label: "App", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} commission${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(c) => String(c._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No commissions match these filters."
            : "No commissions recorded yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "A commission accrues when an externally provisioned software purchase is marked paid."
        }
        minWidth={760}
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
