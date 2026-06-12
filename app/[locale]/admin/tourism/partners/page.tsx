import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  listPartnerApplications,
  type PartnerApplicationListParams,
} from "@/lib/repositories/partnerApplications.repo";
import type { PartnerApplicationStatus } from "@/lib/schemas/partner-application";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusFilterPills } from "@/components/admin/ui/status-filter";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "new", "reviewing", "approved", "rejected"] as const;

type Row = Awaited<ReturnType<typeof listPartnerApplications>>["items"][number];

export default async function AdminPartnersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);

  const filter: PartnerApplicationListParams = { pageSize: 100 };
  if (status && status !== "all")
    filter.status = status as PartnerApplicationStatus;

  let rows: Row[] = [];
  try {
    rows = (await listPartnerApplications(filter)).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (a) => (
        <Link
          href={`/admin/tourism/partners/${String(a._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {a.partnerApplicationNumber}
        </Link>
      ),
    },
    { key: "org", header: "Organization", cell: (a) => a.orgInfo.name },
    {
      key: "type",
      header: "Type",
      cell: (a) => <span className="capitalize">{a.type}</span>,
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
        title="Partner applications"
        description="Hospitals, agencies, and partners applying to join the network."
      />
      <StatusFilterPills
        statuses={STATUSES}
        active={status ?? "all"}
        basePath="/admin/tourism/partners"
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        empty="No partner applications yet."
        minWidth={640}
      />
    </div>
  );
}
