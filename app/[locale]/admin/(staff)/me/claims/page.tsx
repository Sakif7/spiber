import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { parseListQuery, type ListConfig } from "@/lib/admin/list-params";
import { myClaims, myVisitOptions } from "@/lib/services/me.service";
import { formatBDT } from "@/lib/money";
import { EXPENSE_STATUSES } from "@/lib/hr/expense-constants";
import {
  expenseCategoryLabel,
  expenseLinesOf,
  expenseSpanLabel,
} from "@/lib/hr/expense-lines";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { Pagination } from "@/components/admin/ui/pagination";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { ExpenseForm } from "@/components/admin/hr/expense-form";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { employeeOrRedirect, cap, day } from "../_shared";

export const dynamic = "force-dynamic";

const LIST: ListConfig = { filters: ["status"] };

type Row = {
  id: string;
  ref: string;
  description: string;
  lineCount: number;
  category: string;
  amount: string;
  spentAt: string;
  status: string;
  settlement: string;
};

/** Money I have paid out and want back. The office approves and settles. */
export default async function MyClaimsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, "/admin/me/claims");
  const query = parseListQuery(await searchParams, LIST);
  const [page, visits] = await Promise.all([
    myClaims(session, {
      search: query.q,
      status: query.filters.status,
      page: query.page,
      pageSize: query.pageSize,
    }),
    myVisitOptions(session),
  ]);
  const self = [
    {
      id: String(session.employee._id),
      name: session.employee.name,
      designation: session.employee.designation,
    },
  ];

  const rows: Row[] = page.items.map((e) => ({
    id: String(e._id),
    ref: e.ref,
    description: e.description,
    lineCount: expenseLinesOf(e).length,
    category: expenseCategoryLabel(e),
    amount: formatBDT(e.amountMinor, "en"),
    spentAt: expenseSpanLabel(e, day),
    status: e.status,
    settlement:
      e.status === "reimbursed"
        ? e.settlement === "payroll"
          ? "With payroll"
          : "Paid directly"
        : e.status === "approved"
          ? e.settlement === "payroll"
            ? "With your next payout"
            : "Due directly"
          : "",
  }));

  const columns: Column<Row>[] = [
    {
      key: "description",
      header: "Claim",
      cell: (r) => (
        <span>
          <Link
            href={`/admin/me/claims/${r.id}`}
            className="text-primary font-medium hover:underline"
          >
            {r.description}
          </Link>
          <span className="text-muted-foreground block font-mono text-xs">
            {r.ref}
            {r.lineCount > 1 ? ` · ${r.lineCount} lines` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.category}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (r) => <span className="font-mono text-xs">{r.amount}</span>,
    },
    {
      key: "spent",
      header: "Spent on",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.spentAt}</span>,
    },
    {
      key: "status",
      header: "Status",
      mobile: "meta",
      cell: (r) => (
        <span>
          <StatusBadge tone={statusTone(r.status)}>{cap(r.status)}</StatusBadge>
          {r.settlement && (
            <span className="text-muted-foreground block text-xs">
              {r.settlement}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="My claims"
        description="What you paid out of pocket, and where each claim stands."
        action={
          <FormPanelButton
            label="New claim"
            title="New claim"
            description="Amounts are in taka. Attach the receipt when you have it."
          >
            <ExpenseForm
              people={self}
              visits={visits}
              endpoint="/api/admin/me/claims"
              receiptEndpoint="/api/admin/me/claims/receipt"
              afterHref="/admin/me/claims"
            />
          </FormPanelButton>
        }
      />
      <ListToolbar
        search={{ placeholder: "Search description, reference…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            options: EXPENSE_STATUSES.map((s) => ({ value: s, label: cap(s) })),
          },
        ]}
        total={page.total}
        countLabel={`${page.total} claim${page.total === 1 ? "" : "s"}`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No claims yet."
        minWidth={720}
      />
      {page.pages > 1 && (
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
