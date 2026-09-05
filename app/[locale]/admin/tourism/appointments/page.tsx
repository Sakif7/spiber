import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listAppointments } from "@/lib/repositories/appointments.repo";
import {
  appointmentStatusEnum,
  appointmentTypeEnum,
  type AppointmentStatus,
  type AppointmentType,
} from "@/lib/schemas/appointment";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions } from "@/components/admin/ui/row-actions";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = appointmentStatusEnum.options;
const TYPES = appointmentTypeEnum.options;
const TYPE_LABEL: Record<AppointmentType, string> = {
  in_person: "In person",
  teleconsultation: "Teleconsultation",
};

const LIST: ListConfig = {
  sortable: ["date", "number", "patient", "status", "type"],
  defaultSort: "date",
  filters: ["status", "type", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listAppointments>>["items"][number];

export default async function AdminAppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as AppointmentStatus)
    ? (query.filters.status as AppointmentStatus)
    : undefined;
  const type = TYPES.includes(query.filters.type as AppointmentType)
    ? (query.filters.type as AppointmentType)
    : undefined;
  const filtered = Boolean(query.q || status || type || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listAppointments({
      status,
      type,
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
      key: "ref",
      header: "Reference",
      sortKey: "number",
      sortDir: "asc",
      cell: (a) => (
        <Link
          href={`/admin/tourism/appointments/${String(a._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {a.appointmentNumber}
        </Link>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      sortKey: "patient",
      sortDir: "asc",
      cell: (a) => a.patient.name,
    },
    {
      key: "type",
      header: "Type",
      sortKey: "type",
      sortDir: "asc",
      cell: (a) => (
        <span className="text-muted-foreground">
          {TYPE_LABEL[a.type as AppointmentType] ?? a.type}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (a) => <StatusBadge>{a.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
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
      className: "w-10",
      cell: (a) => (
        <RowActions
          label={`Actions for ${a.appointmentNumber}`}
          actions={[
            {
              label: "Open request",
              href: `/admin/tourism/appointments/${String(a._id)}`,
              icon: "view",
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Appointments"
        description="Teleconsultation and in-person appointment requests."
      />

      <ListToolbar
        search={{ placeholder: "Search appointment #, patient, email…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
          {
            param: "type",
            label: "Type",
            kind: "pills",
            options: TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Date" },
            { value: "patient", label: "Patient", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "type", label: "Type", defaultDir: "asc" },
            { value: "number", label: "Reference", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} request${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No appointment requests match these filters."
            : "No appointment requests yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Requests arrive when a patient books a teleconsultation or in-person appointment on the Tourism site."
        }
        minWidth={720}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="requests"
      />
    </div>
  );
}
