import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  listAdminJobs,
  countNewApplications,
} from "@/lib/repositories/career.repo";
import { localize } from "@/lib/schemas/localized";
import {
  employmentTypeEnum,
  jobStatusEnum,
  type JobStatus,
} from "@/lib/schemas/career";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { DeleteRowButton } from "@/components/admin/delete-row-button";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions } from "@/components/admin/ui/row-actions";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import {
  JobForm,
  type JobFormInitial,
} from "@/components/admin/career/job-form";
import { FormPanelTrigger } from "@/components/admin/ui/form-panel";

export const dynamic = "force-dynamic";

const L = (v?: { en?: string; bn?: string }) => ({
  en: v?.en ?? "",
  bn: v?.bn ?? "",
});

/** The list already holds the whole posting, so the edit panel prefills
    straight from the row. */
const editInitial = (job: Row): JobFormInitial => ({
  id: String(job._id),
  title: L(job.title),
  slug: job.slug,
  department: L(job.department),
  reportsTo: L(job.reportsTo),
  location: L(job.location),
  employmentType: job.employmentType,
  experience: L(job.experience),
  vacancies: job.vacancies != null ? String(job.vacancies) : "",
  summary: L(job.summary),
  description: L(job.description),
  responsibilities: L(job.responsibilities),
  requirements: L(job.requirements),
  preferredSkills: L(job.preferredSkills),
  benefits: L(job.benefits),
  applyEmail: job.applyEmail ?? "",
  recruiterName: job.recruiterName ?? "",
  recruiterTitle: L(job.recruiterTitle),
  recruiterEmail: job.recruiterEmail ?? "",
  recruiterPhone: job.recruiterPhone ?? "",
  closesAt: job.closesAt
    ? new Date(job.closesAt).toISOString().slice(0, 10)
    : "",
  status: job.status,
});

const STATUSES = jobStatusEnum.options;
const TYPES = employmentTypeEnum.options;

const TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

const LIST: ListConfig = {
  sortable: ["date", "title", "status", "type", "department"],
  defaultSort: "date",
  filters: ["status", "type", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listAdminJobs>>["items"][number];

export default async function AdminCareerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as JobStatus)
    ? (query.filters.status as JobStatus)
    : undefined;
  const employmentType = (TYPES as readonly string[]).includes(
    query.filters.type,
  )
    ? query.filters.type
    : undefined;
  const filtered = Boolean(
    query.q || status || employmentType || query.filters.from,
  );

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  let newApps = 0;
  try {
    const [res, count] = await Promise.all([
      listAdminJobs({
        status,
        employmentType,
        search: query.q || undefined,
        sort: query.sort,
        dir: query.dir,
        from: query.filters.from,
        to: query.filters.to,
        page: query.page,
        pageSize: query.pageSize,
      }),
      countNewApplications(),
    ]);
    rows = res.items;
    total = res.total;
    pages = res.pages;
    newApps = count;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Title",
      sortKey: "title",
      sortDir: "asc",
      cell: (j) => (
        <FormPanelTrigger
          label={localize(j.title, "en") || "(untitled)"}
          title="Edit job"
          description={j.slug}
        >
          <JobForm initial={editInitial(j)} />
        </FormPanelTrigger>
      ),
    },
    {
      key: "department",
      header: "Department",
      sortKey: "department",
      sortDir: "asc",
      cell: (j) =>
        j.department ? (
          localize(j.department, "en")
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "type",
      header: "Type",
      sortKey: "type",
      sortDir: "asc",
      cell: (j) => (
        <span className="text-muted-foreground">
          {TYPE_LABEL[j.employmentType] ?? j.employmentType}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (j) => <StatusBadge>{j.status}</StatusBadge>,
    },
    {
      key: "created",
      header: "Created",
      align: "right",
      sortKey: "date",
      cell: (j) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(j.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-24",
      cell: (j) => (
        <span className="flex items-center justify-end gap-1">
          <DeleteRowButton
            endpoint={`/api/admin/career/${String(j._id)}`}
            title={localize(j.title, "en")}
          />
          <RowActions
            label={`Actions for ${localize(j.title, "en")}`}
            actions={[
              {
                label: "Edit job",
                icon: "edit",
                panel: {
                  title: "Edit job",
                  description: j.slug,
                  content: <JobForm initial={editInitial(j)} />,
                },
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
        title="Jobs"
        description="Open positions and the applications they receive."
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/career/applications">
                Applications
                {newApps > 0 && (
                  <span className="bg-secondary text-admin-2xs ml-1 inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 font-bold text-white">
                    {newApps}
                  </span>
                )}
              </Link>
            </Button>
            <FormPanelButton
              label="New job"
              title="New job"
              description="A role to advertise on the careers page."
            >
              <JobForm />
            </FormPanelButton>
          </div>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search title, department or location…" }}
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
            options: TYPES.map((t) => ({
              value: t,
              label: TYPE_LABEL[t] ?? t,
            })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Created" },
            { value: "title", label: "Title", defaultDir: "asc" },
            { value: "department", label: "Department", defaultDir: "asc" },
            { value: "type", label: "Type", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} job${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(j) => String(j._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered ? "No jobs match these filters." : "No job postings yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Create the first posting with the New job button; it stays a draft until you open it."
        }
        emptyAction={
          filtered ? undefined : (
            <FormPanelButton
              label="New job"
              title="New job"
              description="A role to advertise on the careers page."
              icon={false}
            >
              <JobForm />
            </FormPanelButton>
          )
        }
        minWidth={760}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="jobs"
      />
    </div>
  );
}
