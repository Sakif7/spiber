import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listEnrollments } from "@/lib/repositories/enrollments.repo";
import { listCourses } from "@/lib/repositories/courses.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import {
  enrollmentStatusEnum,
  type EnrollmentStatus,
} from "@/lib/schemas/enrollment";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { ManualEnrollForm } from "@/components/admin/academy/manual-enroll-form";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions } from "@/components/admin/ui/row-actions";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = enrollmentStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "number", "email", "status", "total"],
  defaultSort: "date",
  filters: ["status", "course", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listEnrollments>>["items"][number];

export default async function AdminEnrollmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as EnrollmentStatus)
    ? (query.filters.status as EnrollmentStatus)
    : undefined;
  const courseId = query.filters.course || undefined;
  const filtered = Boolean(query.q || status || courseId || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  let courseTitles = new Map<string, string>();
  try {
    const [res, courses] = await Promise.all([
      listEnrollments({
        status,
        courseId,
        search: query.q || undefined,
        sort: query.sort,
        dir: query.dir,
        from: query.filters.from,
        to: query.filters.to,
        page: query.page,
        pageSize: query.pageSize,
      }),
      listCourses({ pageSize: 200 }),
    ]);
    rows = res.items;
    total = res.total;
    pages = res.pages;
    courseTitles = new Map(
      courses.items.map((c) => [String(c._id), localize(c.title, "en")]),
    );
  } catch {
    rows = [];
  }

  const courseOptions = Array.from(courseTitles, ([id, title]) => ({
    id,
    title,
  }));

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      sortKey: "number",
      sortDir: "asc",
      cell: (e) => (
        <Link
          href={`/admin/enrollments/${String(e._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {e.enrollmentNumber}
        </Link>
      ),
    },
    {
      key: "course",
      header: "Course",
      cell: (e) => courseTitles.get(String(e.courseId)) ?? "—",
    },
    {
      key: "student",
      header: "Student",
      sortKey: "email",
      sortDir: "asc",
      cell: (e) => e.email,
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (e) => <StatusBadge>{e.status}</StatusBadge>,
    },
    {
      key: "payment",
      header: "Payment",
      cell: (e) => (
        <span className="text-muted-foreground capitalize">
          {e.payment?.status ?? "—"}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortKey: "total",
      className: "font-mono font-medium whitespace-nowrap",
      cell: (e) => (e.totalMinor > 0 ? formatBDT(e.totalMinor, "en") : "Free"),
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      sortKey: "date",
      cell: (e) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(e.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (e) => (
        <RowActions
          label={`Actions for ${e.enrollmentNumber}`}
          actions={[
            {
              label: "Open enrollment",
              href: `/admin/enrollments/${String(e._id)}`,
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
        title="Enrollments"
        description="MedAcademy enrollments — payment status and student access."
      />

      <ListToolbar
        search={{ placeholder: "Search enrollment # or student email…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
          ...(courseOptions.length > 0
            ? [
                {
                  param: "course",
                  label: "Course",
                  kind: "select" as const,
                  options: courseOptions.map((c) => ({
                    value: c.id,
                    label: c.title,
                  })),
                  allLabel: "All courses",
                },
              ]
            : []),
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Date" },
            { value: "total", label: "Total" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "email", label: "Student", defaultDir: "asc" },
            { value: "number", label: "Reference", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} enrollment${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(e) => String(e._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No enrollments match these filters."
            : "No enrollments yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Enrollments are created when a student enrols on the MedAcademy site, or manually with the form below."
        }
        minWidth={840}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="enrollments"
      />

      <SectionCard
        title="Manual enrollment"
        description="Enrol a student directly, e.g. for an offline payment or a complimentary seat."
      >
        <ManualEnrollForm courses={courseOptions} />
      </SectionCard>
    </div>
  );
}
