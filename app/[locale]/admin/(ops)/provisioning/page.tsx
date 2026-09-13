import { setRequestLocale } from "next-intl/server";
import { listProvisioningTasksForAdmin } from "@/lib/repositories/provisioning.repo";
import {
  provisioningStatusEnum,
  type ProvisioningStatus,
} from "@/lib/schemas/systems";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { StatusRowActions } from "@/components/admin/status-row-actions";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = provisioningStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "app", "email", "status"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<
  ReturnType<typeof listProvisioningTasksForAdmin>
>["items"][number];

export default async function AdminProvisioningPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as ProvisioningStatus)
    ? (query.filters.status as ProvisioningStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listProvisioningTasksForAdmin({
      status,
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
      key: "app",
      header: "App",
      sortKey: "app",
      sortDir: "asc",
      cell: (task) => task.externalApp,
    },
    {
      key: "user",
      header: "User",
      sortKey: "email",
      sortDir: "asc",
      cell: (task) => (
        <span className="text-muted-foreground">{task.email}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (task) => <StatusBadge>{task.status}</StatusBadge>,
    },
    {
      key: "created",
      header: "Created",
      sortKey: "date",
      cell: (task) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(task.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      cell: (task) =>
        task.status === "done" ? (
          <span className="font-medium text-[var(--tone-success-fg)]">
            Done
          </span>
        ) : (
          <StatusRowActions
            endpoint={`/api/admin/provisioning/${String(task._id)}`}
            actions={[
              { to: "in_progress", label: "Start" },
              { to: "done", label: "Mark done" },
            ]}
          />
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Provisioning queue"
        description="External-app activations (e.g. ZenHcare). Activate the user in the external app, then mark the task done here."
      />

      <ListToolbar
        search={{ placeholder: "Search app or user email…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({
              value: s,
              label: s.replace(/_/g, ""),
            })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Created" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "app", label: "App", defaultDir: "asc" },
            { value: "email", label: "User", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} task${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(task) => String(task._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No provisioning tasks match these filters."
            : "No provisioning tasks."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "A task is created when a customer buys an externally provisioned software product."
        }
        minWidth={700}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="tasks"
      />
    </div>
  );
}
