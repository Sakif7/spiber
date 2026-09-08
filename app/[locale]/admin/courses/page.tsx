import { setRequestLocale } from "next-intl/server";
import { listCoursesForAdmin } from "@/lib/repositories/courses.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import {
  courseLevelEnum,
  courseStatusEnum,
  type CourseLevel,
  type CourseStatus,
} from "@/lib/schemas/academy";
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
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { CourseBuilder } from "@/components/admin/academy/course-builder";
import { CourseBuilderPanel } from "@/components/admin/academy/course-builder-panel";
import { FormPanelTrigger } from "@/components/admin/ui/form-panel";

export const dynamic = "force-dynamic";

const STATUSES = courseStatusEnum.options;
const LEVELS = courseLevelEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "title", "price", "status", "level"],
  defaultSort: "date",
  filters: ["status", "level", "from", "to"],
};

type Row = {
  id: string;
  title: string;
  level: string;
  priceMinor: number;
  lessons: number;
  status: string;
  createdAt: string;
};

export default async function AdminCoursesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as CourseStatus)
    ? (query.filters.status as CourseStatus)
    : undefined;
  const level = LEVELS.includes(query.filters.level as CourseLevel)
    ? (query.filters.level as CourseLevel)
    : undefined;
  const filtered = Boolean(query.q || status || level || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listCoursesForAdmin({
      status,
      level,
      search: query.q || undefined,
      sort: query.sort,
      dir: query.dir,
      from: query.filters.from,
      to: query.filters.to,
      page: query.page,
      pageSize: query.pageSize,
    });
    total = res.total;
    pages = res.pages;
    rows = res.items.map((c) => ({
      id: String(c._id),
      title: localize(c.title, "en"),
      level: c.level,
      priceMinor: c.priceMinor,
      lessons: c.modules.reduce((s, m) => s + m.lessons.length, 0),
      status: c.status,
      createdAt: new Date(c.createdAt).toISOString(),
    }));
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Title",
      sortKey: "title",
      sortDir: "asc",
      cell: (c) => (
        <FormPanelTrigger label={c.title || "(untitled)"} title="Edit course">
          <CourseBuilderPanel id={c.id} />
        </FormPanelTrigger>
      ),
    },
    {
      key: "level",
      header: "Level",
      sortKey: "level",
      sortDir: "asc",
      cell: (c) => (
        <span className="text-muted-foreground capitalize">{c.level}</span>
      ),
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      sortKey: "price",
      cell: (c) => (c.priceMinor > 0 ? formatBDT(c.priceMinor, "en") : "Free"),
    },
    {
      key: "lessons",
      header: "Lessons",
      align: "right",
      cell: (c) => c.lessons,
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (c) => <StatusBadge>{c.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Created",
      align: "right",
      sortKey: "date",
      cell: (c) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(c.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (c) => (
        <RowActions
          label={`Actions for ${c.title}`}
          actions={[
            {
              label: "Edit course",
              icon: "edit",
              panel: {
                title: "Edit course",
                content: <CourseBuilderPanel id={c.id} />,
              },
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Courses"
        description="MedAcademy courses — content, pricing, and publish status."
        action={
          <FormPanelButton
            label="New course"
            title="New course"
            description="A MedAcademy course — content, pricing and publish status."
          >
            <CourseBuilder />
          </FormPanelButton>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search course title…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
          {
            param: "level",
            label: "Level",
            kind: "pills",
            options: LEVELS.map((l) => ({ value: l, label: l })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Created" },
            { value: "title", label: "Title", defaultDir: "asc" },
            { value: "price", label: "Price" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "level", label: "Level", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} course${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(c) => c.id}
        sort={{ key: query.sort, dir: query.dir }}
        empty={filtered ? "No courses match these filters." : "No courses yet."}
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Create the first course with the New course button; it stays a draft until you publish it."
        }
        emptyAction={
          filtered ? undefined : (
            <FormPanelButton
              label="New course"
              title="New course"
              description="A MedAcademy course — content, pricing and publish status."
              icon={false}
            >
              <CourseBuilder />
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
        noun="courses"
      />
    </div>
  );
}
