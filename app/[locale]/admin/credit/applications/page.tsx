import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listCreditApplications } from "@/lib/repositories/credit-applications.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { StatusFilterPills } from "@/components/admin/ui/status-filter";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import type { CreditApplicationStatus } from "@/lib/schemas/credit";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "new", "reviewing", "approved", "rejected"] as const;
const VALID = new Set(["new", "reviewing", "approved", "rejected"]);

type Row = Awaited<ReturnType<typeof listCreditApplications>>[number];

export default async function AdminCreditApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status: raw } = await searchParams;
  const status =
    raw && VALID.has(raw) ? (raw as CreditApplicationStatus) : undefined;

  let rows: Row[] = [];
  try {
    rows = await listCreditApplications({ status });
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (a) => (
        <Link
          href={`/admin/credit/applications/${String(a._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {a.applicationNumber}
        </Link>
      ),
    },
    {
      key: "organization",
      header: "Organisation",
      cell: (a) => a.organization,
    },
    { key: "contactName", header: "Contact", cell: (a) => a.contactName },
    {
      key: "docs",
      header: "Docs",
      cell: (a) => (
        <span className="text-muted-foreground">{a.documents.length}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusBadge>{a.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      cell: (a) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(a.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Credit applications"
        description="Hospitals and clinics applying to buy on Medtrade credit terms."
      />
      <StatusFilterPills
        statuses={STATUSES}
        active={status ?? "all"}
        basePath="/admin/credit/applications"
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        empty="No credit applications yet."
        minWidth={720}
      />
    </div>
  );
}
