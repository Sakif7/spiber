import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { DeleteRowButton } from "@/components/admin/delete-row-button";
import { ApplicationStatusSelect } from "@/components/admin/career/application-status";
import { listApplications } from "@/lib/repositories/career.repo";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listApplications>>["items"][number];

export default async function AdminApplicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = (await listApplications({ pageSize: 100 })).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "applicant",
      header: "Applicant",
      cell: (a) => (
        <div>
          <Link
            href={`/admin/career/applications/${String(a._id)}`}
            className="text-primary font-medium hover:underline"
          >
            {a.name}
          </Link>
          <div className="text-muted-foreground text-xs">{a.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (a) => a.jobTitle ?? "—",
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => (
        <ApplicationStatusSelect id={String(a._id)} status={a.status} />
      ),
    },
    {
      key: "applied",
      header: "Applied",
      cell: (a) => (
        <span className="text-muted-foreground">
          {new Date(a.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (a) => (
        <div className="inline-flex items-center gap-2">
          <a
            href={`/api/admin/career/applications/${String(a._id)}/resume`}
            className="text-primary font-medium hover:underline"
          >
            Résumé
          </a>
          <DeleteRowButton
            endpoint={`/api/admin/career/applications/${String(a._id)}`}
            title={a.name}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Applications"
        description="Candidate submissions across all open positions."
        action={
          <Button asChild variant="outline">
            <Link href="/admin/career">
              <ArrowLeft className="size-4" />
              Jobs
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        empty="No applications yet."
        minWidth={720}
      />
    </div>
  );
}
