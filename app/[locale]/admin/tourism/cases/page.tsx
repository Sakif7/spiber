import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  listMedicalCases,
  type MedicalCaseListParams,
} from "@/lib/repositories/medicalCases.repo";
import { formatBDT } from "@/lib/money";
import type { MedicalCaseStatus } from "@/lib/schemas/medical-case";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusFilterPills } from "@/components/admin/ui/status-filter";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = [
  "all",
  "new",
  "reviewing",
  "quoted",
  "confirmed",
  "arranging",
  "in_treatment",
  "follow_up",
  "closed",
  "lost",
] as const;

type Row = Awaited<ReturnType<typeof listMedicalCases>>["items"][number];

export default async function AdminCasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);

  const filter: MedicalCaseListParams = { pageSize: 100 };
  if (status && status !== "all") filter.status = status as MedicalCaseStatus;

  let rows: Row[] = [];
  try {
    rows = (await listMedicalCases(filter)).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (c) => (
        <Link
          href={`/admin/tourism/cases/${String(c._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {c.caseNumber}
        </Link>
      ),
    },
    { key: "patient", header: "Patient", cell: (c) => c.patient.name },
    {
      key: "country",
      header: "Country",
      cell: (c) => (
        <span className="text-muted-foreground">{c.patient.country}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusBadge>{c.status}</StatusBadge>,
    },
    {
      key: "docs",
      header: "Docs",
      align: "right",
      cell: (c) => c.documents?.length ?? 0,
    },
    {
      key: "quoted",
      header: "Quoted",
      align: "right",
      cell: (c) =>
        c.quotation?.amountMinor != null
          ? formatBDT(c.quotation.amountMinor, "en")
          : "—",
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      cell: (c) => (
        <span className="text-muted-foreground">
          {new Date(c.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Medical cases"
        description="Patient case pipeline — review, quote, and arrange treatment."
      />
      <StatusFilterPills
        statuses={STATUSES}
        active={status ?? "all"}
        basePath="/admin/tourism/cases"
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(c) => String(c._id)}
        empty="No medical cases yet."
        minWidth={760}
      />
    </div>
  );
}
