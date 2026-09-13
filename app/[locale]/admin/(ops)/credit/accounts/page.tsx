import { setRequestLocale } from "next-intl/server";
import { listCreditAccounts } from "@/lib/repositories/credit-accounts.repo";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { CreditAccountActions } from "@/components/admin/credit-account-actions";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = ["active", "suspended"] as const;

const LIST: ListConfig = {
  sortable: ["date", "organization", "terms", "status"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listCreditAccounts>>["items"][number];

export default async function AdminCreditAccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = (STATUSES as readonly string[]).includes(query.filters.status)
    ? (query.filters.status as (typeof STATUSES)[number])
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listCreditAccounts({
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
      key: "organization",
      header: "Organisation",
      sortKey: "organization",
      sortDir: "asc",
      cell: (a) => <span className="font-medium">{a.organization}</span>,
    },
    {
      key: "terms",
      header: "Terms",
      sortKey: "terms",
      cell: (a) => <span className="whitespace-nowrap">Net {a.termsDays}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (a) => <StatusBadge>{a.status}</StatusBadge>,
    },
    {
      key: "since",
      header: "Since",
      sortKey: "date",
      cell: (a) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(a.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      cell: (a) => (
        <CreditAccountActions
          accountId={String(a._id)}
          termsDays={a.termsDays}
          status={a.status}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Credit accounts"
        description="Enlisted buyers who can pay on terms. Suspending takes effect on their next checkout."
      />

      <ListToolbar
        search={{ placeholder: "Search organisation…" }}
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
            { value: "date", label: "Since" },
            { value: "organization", label: "Organisation", defaultDir: "asc" },
            { value: "terms", label: "Terms" },
            { value: "status", label: "Status", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} account${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No credit accounts match these filters."
            : "No credit accounts yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "An account is provisioned when you approve a credit application."
        }
        minWidth={720}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="accounts"
      />
    </div>
  );
}
