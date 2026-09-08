import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import {
  listEmployees,
  rateForMonth,
} from "@/lib/services/hr/employee.service";
import { monthOf } from "@/lib/hr/months";
import { rateLabel } from "@/lib/hr/payroll-math";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  code: string;
  designation: string;
  kind: string;
  scheme: string;
  rate: string;
  status: string;
};

const SCHEME_LABEL: Record<string, string> = {
  revenue_share: "Share of revenue",
  fixed: "Fixed monthly",
  none: "Not paid here",
};

/** The people on the payroll — the directors today. */
export default async function EmployeesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const month = monthOf(new Date());
  const employees = await listEmployees({ includeInactive: true }).catch(
    () => [],
  );
  const rows: Row[] = await Promise.all(
    employees.map(async (e) => {
      const rateBp =
        e.payScheme === "revenue_share"
          ? await rateForMonth(String(e._id), month)
          : null;
      return {
        id: String(e._id),
        name: e.name,
        code: e.code,
        designation: e.designation,
        kind: e.kind,
        scheme: SCHEME_LABEL[e.payScheme] ?? e.payScheme,
        rate: rateBp == null ? "—" : `${rateLabel(rateBp)}%`,
        status: e.status,
      };
    }),
  );

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => (
        <span>
          <Link
            href={`/admin/company/people/employees/${r.id}`}
            className="text-primary font-medium hover:underline"
          >
            {r.name}
          </Link>
          <span className="text-muted-foreground block text-xs">
            {r.designation}
          </span>
        </span>
      ),
    },
    {
      key: "scheme",
      header: "Paid by",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.scheme}</span>,
    },
    {
      key: "rate",
      header: "Share now",
      align: "right",
      mobile: "meta",
      cell: (r) => <span className="font-mono text-xs">{r.rate}</span>,
    },
    {
      key: "status",
      header: "Status",
      mobile: "meta",
      cell: (r) => (
        <StatusBadge tone={r.status === "active" ? "success" : "neutral"}>
          {r.status === "active" ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Employees"
        description="Who is on the payroll, and how each of them is paid."
        action={
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/admin/company/people/employees/new">
              <Plus className="size-4" />
              Add employee
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="Nobody on the payroll yet — add the directors."
        minWidth={640}
      />
    </div>
  );
}
