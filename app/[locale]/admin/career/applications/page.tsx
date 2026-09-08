import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  listApplications,
  listAdminJobs,
} from "@/lib/repositories/career.repo";
import { localize } from "@/lib/schemas/localized";
import {
  applicationStatusEnum,
  type ApplicationStatus,
} from "@/lib/schemas/career";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { DeleteRowButton } from "@/components/admin/delete-row-button";
import { ApplicationStatusSelect } from "@/components/admin/career/application-status";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions } from "@/components/admin/ui/row-actions";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = applicationStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "name", "status", "role"],
  defaultSort: "date",
  filters: ["status", "job", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listApplications>>["items"][number];
type JobOption = { value: string; label: string };

export default async function AdminApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as ApplicationStatus)
    ? (query.filters.status as ApplicationStatus)
    : undefined;
  const jobId = query.filters.job || undefined;
  const filtered = Boolean(query.q || status || jobId || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  let jobs: JobOption[] = [];
  try {
    const [res, jobRes] = await Promise.all([
      listApplications({
        status,
        jobId,
        search: query.q || undefined,
        sort: query.sort,
        dir: query.dir,
        from: query.filters.from,
        to: query.filters.to,
        page: query.page,
        pageSize: query.pageSize,
      }),
      listAdminJobs({ pageSize: 100, sort: "title", dir: "asc" }),
    ]);
    rows = res.items;
    total = res.total;
    pages = res.pages;
    jobs = jobRes.items.map((j) => ({
      value: String(j._id),
      label: localize(j.title, "en") || "(untitled)",
    }));
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "applicant",
      header: "Applicant",
      sortKey: "name",
      sortDir: "asc",
      cell: (a) => (
        <div className="min-w-0">
          <Link
            href={`/admin/career/applications/${String(a._id)}`}
            className="text-primary font-medium hover:underline"
          >
            {a.name}
          </Link>
          <div className="text-muted-foreground truncate text-xs">
            {a.email}
            {a.phone ? ` · ${a.phone}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortKey: "role",
      sortDir: "asc",
      cell: (a) =>
        a.jobTitle ? (
          a.jobTitle
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (a) => (
        <ApplicationStatusSelect id={String(a._id)} status={a.status} />
      ),
    },
    {
      key: "applied",
      header: "Applied",
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
      className: "w-36",
      cell: (a) => (
        <span className="flex items-center justify-end gap-1">
          <a
            href={`/api/admin/career/applications/${String(a._id)}/resume`}
            className="text-primary px-1 font-medium whitespace-nowrap hover:underline"
          >
            Résumé
          </a>
          <DeleteRowButton
            endpoint={`/api/admin/career/applications/${String(a._id)}`}
            title={a.name}
          />
          <RowActions
            label={`Actions for ${a.name}`}
            actions={[
              {
                label: "Open application",
                href: `/admin/career/applications/${String(a._id)}`,
                icon: "view",
              },
            ]}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Applications"
        description="Candidate submissions across all positions."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/career">
              <ArrowLeft className="size-4" />
              Jobs
            </Link>
          </Button>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search name, email or role…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
          {
            param: "job",
            label: "Job",
            kind: "select",
            allLabel: "All jobs",
            options: jobs,
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Applied" },
            { value: "name", label: "Applicant", defaultDir: "asc" },
            { value: "role", label: "Role", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} application${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No applications match these filters."
            : "No applications yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Applications land here as soon as a candidate applies to an open job."
        }
        minWidth={820}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="applications"
      />
    </div>
  );
}
