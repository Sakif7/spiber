import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
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

export const dynamic = "force-dynamic";

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
        <Link
          href={`/admin/career/${String(j._id)}`}
          className="text-primary font-medium hover:underline"
        >
          {localize(j.title, "en") || "(untitled)"}
        </Link>
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
                href: `/admin/career/${String(j._id)}`,
                icon: "edit",
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
            <Button asChild size="sm">
              <Link href="/admin/career/new">
                <Plus className="size-4" />
                New job
              </Link>
            </Button>
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
            <Button asChild size="sm">
              <Link href="/admin/career/new">New job</Link>
            </Button>
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
