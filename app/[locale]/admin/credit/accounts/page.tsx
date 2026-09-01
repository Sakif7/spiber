import { setRequestLocale } from "next-intl/server";
import { listCreditAccounts } from "@/lib/repositories/credit-accounts.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { CreditAccountActions } from "@/components/admin/credit-account-actions";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listCreditAccounts>>["items"][number];

export default async function AdminCreditAccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = (await listCreditAccounts({ pageSize: 100 })).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "organization",
      header: "Organisation",
      cell: (a) => <span className="font-medium">{a.organization}</span>,
    },
    {
      key: "terms",
      header: "Terms",
      cell: (a) => <span className="whitespace-nowrap">Net {a.termsDays}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusBadge>{a.status}</StatusBadge>,
    },
    {
      key: "since",
      header: "Since",
      cell: (a) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(a.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
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
    <div className="space-y-6">
      <AdminPageHeader
        title="Credit accounts"
        description="Enlisted buyers who can pay on terms. Suspending takes effect on their next checkout."
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        empty="No credit accounts yet."
        minWidth={720}
      />
    </div>
  );
}
