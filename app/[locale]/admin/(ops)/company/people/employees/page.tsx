import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  getSharePool,
  holdingForMonth,
  listEmployees,
} from "@/lib/services/hr/employee.service";
import { monthOf } from "@/lib/hr/months";
import { rateLabel } from "@/lib/hr/payroll-math";
import { holdingPercent } from "@/lib/hr/share-pool";
import { SharePoolCard } from "@/components/admin/hr/share-pool-card";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { EmployeeForm } from "@/components/admin/hr/employee-form";
import { mailDomain } from "@/lib/mail/config";
import { listSchedules } from "@/lib/services/hr/pay-schedule.service";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  code: string;
  designation: string;
  kind: string;
  scheme: string;
  /** Their pay schedule's name. */
  schedule: string;
  /** "2,000 shares" / "14.29%" / "20% (legacy)" / "—". */
  holding: string;
  holdingHint: string | null;
  shares: number;
  status: string;
};

const SCHEME_LABEL: Record<string, string> = {
  revenue_share: "Shareholder",
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
  const [employees, pool, schedules] = await Promise.all([
    listEmployees({ includeInactive: true }).catch(() => []),
    getSharePool().catch(() => ({ totalShares: 0, faceValueMinor: null })),
    listSchedules().catch(() => []),
  ]);
  const defaultSchedule = schedules.find((s) => s.isDefault);
  const scheduleName = (id: unknown): string =>
    (id ? schedules.find((s) => s.id === String(id))?.name : undefined) ??
    defaultSchedule?.name ??
    "Monthly";
  const rows: Row[] = await Promise.all(
    employees.map(async (e) => {
      const holding =
        e.payScheme === "revenue_share"
          ? await holdingForMonth(String(e._id), month)
          : null;
      const shares = holding && "shares" in holding ? holding.shares : 0;
      return {
        id: String(e._id),
        name: e.name,
        code: e.code,
        designation: e.designation,
        kind: e.kind,
        scheme: SCHEME_LABEL[e.payScheme] ?? e.payScheme,
        schedule: scheduleName(e.payScheduleId),
        holding: !holding
          ? "—"
          : "shares" in holding
            ? `${holding.shares.toLocaleString("en-BD")} shares`
            : `${rateLabel(holding.rateBp)}% (legacy)`,
        holdingHint:
          holding && "shares" in holding && pool.totalShares > 0
            ? `${holdingPercent(holding.shares, pool.totalShares)}% of the pool`
            : null,
        shares,
        status: e.status,
      };
    }),
  );
  // Held by everyone as of this month, for the pool card. Inactive people
  // count too while their holding says they hold something.
  const allocated = rows.reduce((n, r) => n + r.shares, 0);
  const holders = rows.filter((r) => r.shares > 0).length;

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
      cell: (r) => (
        <span>
          <span className="text-muted-foreground">{r.scheme}</span>
          <span className="text-muted-foreground block text-xs">
            {r.schedule}
          </span>
        </span>
      ),
    },
    {
      key: "holding",
      header: "Holding now",
      align: "right",
      mobile: "meta",
      cell: (r) => (
        <span className="block text-right">
          <span className="font-mono text-xs">{r.holding}</span>
          {r.holdingHint && (
            <span className="text-muted-foreground block text-xs">
              {r.holdingHint}
            </span>
          )}
        </span>
      ),
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
          <FormPanelButton
            label="Add employee"
            title="Add employee"
            description="Someone on the payroll, and how they are paid."
          >
            <EmployeeForm
              mailDomain={mailDomain()}
              schedules={schedules
                .filter((s) => !s.isDefault)
                .map((s) => ({ value: s.id, label: s.name }))}
              defaultScheduleName={defaultSchedule?.name ?? "Monthly"}
            />
          </FormPanelButton>
        }
      />
      <SharePoolCard
        totalShares={pool.totalShares}
        faceValueMinor={pool.faceValueMinor ?? null}
        allocated={allocated}
        directors={holders}
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
