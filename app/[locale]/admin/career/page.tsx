import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { DeleteRowButton } from "@/components/admin/delete-row-button";
import {
  listAdminJobs,
  countNewApplications,
} from "@/lib/repositories/career.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

type Row = Awaited<ReturnType<typeof listAdminJobs>>["items"][number];

export default async function AdminCareerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  let newApps = 0;
  try {
    rows = (await listAdminJobs({ pageSize: 100 })).items;
    newApps = await countNewApplications();
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Title",
      cell: (j) => (
        <Link
          href={`/admin/career/${String(j._id)}`}
          className="text-primary font-medium hover:underline"
        >
          {localize(j.title, "en")}
        </Link>
      ),
    },
    {
      key: "department",
      header: "Department",
      cell: (j) => (j.department ? localize(j.department, "en") : "—"),
    },
    {
      key: "type",
      header: "Type",
      cell: (j) => TYPE_LABEL[j.employmentType] ?? j.employmentType,
    },
    {
      key: "status",
      header: "Status",
      cell: (j) => <StatusBadge>{j.status}</StatusBadge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (j) => (
        <div className="inline-flex items-center gap-2">
          <Link
            href={`/admin/career/${String(j._id)}`}
            className="text-primary font-medium hover:underline"
          >
            Edit
          </Link>
          <DeleteRowButton
            endpoint={`/api/admin/career/${String(j._id)}`}
            title={localize(j.title, "en")}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Career — Jobs"
        description="Open positions and the applications they receive."
        action={
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/admin/career/applications">
                Applications
                {newApps > 0 && (
                  <span className="bg-secondary ml-1 inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white">
                    {newApps}
                  </span>
                )}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/career/new">
                <Plus className="size-4" />
                New job
              </Link>
            </Button>
          </div>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(j) => String(j._id)}
        empty="No job postings yet."
        minWidth={720}
      />
    </div>
  );
}
