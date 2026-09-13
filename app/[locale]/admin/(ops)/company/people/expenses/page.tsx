import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { parseListQuery, type ListConfig } from "@/lib/admin/list-params";
import {
  listExpenses,
  employeeNames,
  expenseTotals,
  activeEmployeeOptions,
  listVisits,
} from "@/lib/repositories/expenses.repo";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
} from "@/lib/hr/expense-constants";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { StatCard } from "@/components/admin/ui/stat-card";
import { formatBDT } from "@/lib/money";
import { Inbox, Wallet, Banknote } from "lucide-react";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { ExpenseForm } from "@/components/admin/hr/expense-form";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  sortable: ["date", "amount", "status", "category", "created"],
  defaultSort: "date",
  filters: ["status", "category", "settlement", "from", "to"],
};

type Row = {
  id: string;
  ref: string;
  description: string;
  who: string;
  category: string;
  amount: string;
  date: string;
  status: string;
  settlement: string;
};

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/** Expense claims: costs directors are owed back. */
export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = parseListQuery(await searchParams, LIST);

  const [page, totals] = await Promise.all([
    listExpenses({
      search: query.q,
      status: query.filters.status,
      category: query.filters.category,
      settlement: query.filters.settlement,
      from: query.filters.from,
      to: query.filters.to,
      sort: query.sort,
      dir: query.dir,
      page: query.page,
      pageSize: query.pageSize,
    }).catch(() => null),
    expenseTotals().catch(() => null),
  ]);

  const names = await employeeNames(
    (page?.items ?? []).map((e) => String(e.employeeId)),
  ).catch(() => new Map());

  // For the record-a-cost panel.
  const [people, visitPage] = await Promise.all([
    activeEmployeeOptions().catch(() => []),
    listVisits({ pageSize: 100 }).catch(() => null),
  ]);
  const visitOptions = (visitPage?.items ?? []).map((v) => ({
    id: String(v._id),
    label: `${new Date(v.visitedAt).toLocaleDateString("en-GB", {
      timeZone: "Asia/Dhaka",
    })} — ${v.purpose}`,
  }));

  const rows: Row[] = (page?.items ?? []).map((e) => ({
    id: String(e._id),
    ref: e.ref,
    description: e.description,
    who: names.get(String(e.employeeId))?.name ?? "—",
    category: cap(e.category),
    amount: formatBDT(e.amountMinor, "en"),
    date: new Date(e.spentAt).toLocaleDateString("en-GB", {
      timeZone: "Asia/Dhaka",
    }),
    status: e.status,
    settlement:
      e.status === "approved" && e.settlement === "payroll"
        ? `Payroll ${e.payrollMonth ?? ""}`.trim()
        : e.status === "approved" && e.settlement === "direct"
          ? "Direct payout"
          : "",
  }));

  const columns: Column<Row>[] = [
    {
      key: "description",
      header: "Claim",
      cell: (r) => (
        <Link
          href={`/admin/company/people/expenses/${r.id}`}
          className="text-primary font-medium hover:underline"
        >
          {r.description}
        </Link>
      ),
    },
    {
      key: "who",
      header: "Paid by",
      mobile: "meta",
      cell: (r) => <span>{r.who}</span>,
    },
    {
      key: "category",
      header: "Category",
      sortKey: "category",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.category}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      mobile: "meta",
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge tone={statusTone(r.status)}>{cap(r.status)}</StatusBadge>
          {r.settlement && (
            <span className="text-muted-foreground text-admin-2xs">
              {r.settlement}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "date",
      header: "Spent",
      sortKey: "date",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.date}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      sortKey: "amount",
      align: "right",
      mobile: "meta",
      cell: (r) => <span className="tabular-nums">{r.amount}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Expenses"
        description="Costs incurred on company business, and how each one gets paid back."
        action={
          <FormPanelButton
            label="Record a cost"
            title="Record a cost"
            description="What was spent, by whom, and what for."
          >
            <ExpenseForm people={people} visits={visitOptions} />
          </FormPanelButton>
        }
      />

      {totals && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Waiting on you"
            value={formatBDT(totals.submitted.amountMinor, "en")}
            hint={`${totals.submitted.count} claim${totals.submitted.count === 1 ? "" : "s"} to decide`}
            icon={Inbox}
            tone="warning"
          />
          <StatCard
            label="Due with payroll"
            value={formatBDT(totals.awaitingPayroll.amountMinor, "en")}
            hint={`${totals.awaitingPayroll.count} approved`}
            icon={Wallet}
            tone="brand"
          />
          <StatCard
            label="Due as a payout"
            value={formatBDT(totals.awaitingDirect.amountMinor, "en")}
            hint={`${totals.awaitingDirect.count} approved`}
            icon={Banknote}
            tone="info"
          />
        </div>
      )}

      <ListToolbar
        search={{ placeholder: "Search description or reference…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            options: EXPENSE_STATUSES.map((s) => ({ value: s, label: cap(s) })),
          },
          {
            param: "category",
            label: "Category",
            options: EXPENSE_CATEGORIES.map((c) => ({
              value: c,
              label: cap(c),
            })),
          },
          {
            param: "settlement",
            label: "Settlement",
            options: [
              { value: "payroll", label: "With payroll" },
              { value: "direct", label: "Direct payout" },
            ],
          },
        ]}
        sort={{
          options: [
            { value: "date", label: "Date spent" },
            { value: "amount", label: "Amount" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "created", label: "Recently added" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        dateRange
        total={page?.total ?? 0}
        countLabel={`${page?.total ?? 0} claim${(page?.total ?? 0) === 1 ? "" : "s"}`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No claims recorded yet."
        minWidth={820}
      />
      {page && page.pages > 1 && (
        <Pagination
          page={page.page}
          pages={page.pages}
          total={page.total}
          pageSize={page.pageSize}
          noun="claims"
        />
      )}
    </div>
  );
}
