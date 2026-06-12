import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  listTravelRequests,
  type TravelRequestListParams,
} from "@/lib/repositories/travelRequests.repo";
import { formatBDT } from "@/lib/money";
import type { TravelRequestStatus } from "@/lib/schemas/travel-request";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusFilterPills } from "@/components/admin/ui/status-filter";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = [
  "all",
  "new",
  "quoted",
  "confirmed",
  "closed",
  "cancelled",
] as const;

type Row = Awaited<ReturnType<typeof listTravelRequests>>["items"][number];

export default async function AdminTravelPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);

  const filter: TravelRequestListParams = { pageSize: 100 };
  if (status && status !== "all") filter.status = status as TravelRequestStatus;

  let rows: Row[] = [];
  try {
    rows = (await listTravelRequests(filter)).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (r) => (
        <Link
          href={`/admin/tourism/travel/${String(r._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {r.travelRequestNumber}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (r) => <span className="capitalize">{r.type}</span>,
    },
    {
      key: "contact",
      header: "Contact",
      cell: (r) => (
        <span className="text-muted-foreground">{r.contact.name}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge>{r.status}</StatusBadge>,
    },
    {
      key: "quoted",
      header: "Quoted",
      align: "right",
      cell: (r) =>
        r.quote?.amountMinor != null
          ? formatBDT(r.quote.amountMinor, "en")
          : "—",
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      cell: (r) => (
        <span className="text-muted-foreground">
          {new Date(r.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Travel requests"
        description="Air ticket, hotel, visa, and transfer requests."
      />
      <StatusFilterPills
        statuses={STATUSES}
        active={status ?? "all"}
        basePath="/admin/tourism/travel"
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        empty="No travel requests yet."
        minWidth={680}
      />
    </div>
  );
}
