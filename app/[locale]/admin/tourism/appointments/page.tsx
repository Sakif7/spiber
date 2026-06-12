import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  listAppointments,
  type AppointmentListParams,
} from "@/lib/repositories/appointments.repo";
import type { AppointmentStatus } from "@/lib/schemas/appointment";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusFilterPills } from "@/components/admin/ui/status-filter";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = [
  "all",
  "pending",
  "confirmed",
  "completed",
  "cancelled",
] as const;

type Row = Awaited<ReturnType<typeof listAppointments>>["items"][number];

export default async function AdminAppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);

  const filter: AppointmentListParams = { pageSize: 100 };
  if (status && status !== "all") filter.status = status as AppointmentStatus;

  let rows: Row[] = [];
  try {
    rows = (await listAppointments(filter)).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (a) => (
        <Link
          href={`/admin/tourism/appointments/${String(a._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {a.appointmentNumber}
        </Link>
      ),
    },
    { key: "patient", header: "Patient", cell: (a) => a.patient.name },
    {
      key: "type",
      header: "Type",
      cell: (a) => (
        <span className="text-muted-foreground capitalize">
          {a.type.replace(/_/g, " ")}
        </span>
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
        <span className="text-muted-foreground">
          {new Date(a.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Appointments"
        description="Teleconsultation and in-person appointment requests."
      />
      <StatusFilterPills
        statuses={STATUSES}
        active={status ?? "all"}
        basePath="/admin/tourism/appointments"
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        empty="No appointment requests yet."
        minWidth={620}
      />
    </div>
  );
}
