import { setRequestLocale } from "next-intl/server";
import { listAdminEvents } from "@/lib/repositories/events.repo";
import { localize } from "@/lib/schemas/localized";
import { eventStatusEnum, type EventStatus } from "@/lib/schemas/events";
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
  EventForm,
  type EventFormInitial,
} from "@/components/admin/events/event-form";
import { FormPanelTrigger } from "@/components/admin/ui/form-panel";

export const dynamic = "force-dynamic";

const L = (v?: { en?: string; bn?: string; ja?: string }) => ({
  en: v?.en ?? "",
  bn: v?.bn ?? "",
  ja: v?.ja ?? "",
});
const dtLocal = (d?: Date | null) =>
  d ? new Date(d).toISOString().slice(0, 16) : "";

/** The list already holds the whole document, so the edit panel prefills
    straight from the row. */
const editInitial = (ev: Row): EventFormInitial => ({
  id: String(ev._id),
  title: L(ev.title),
  slug: ev.slug,
  summary: L(ev.summary),
  description: L(ev.description),
  coverImage: ev.coverImage ?? "",
  startDate: dtLocal(ev.startDate),
  endDate: dtLocal(ev.endDate),
  location: L(ev.location),
  registrationUrl: ev.registrationUrl ?? "",
  status: ev.status,
});

const STATUSES = eventStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["start", "date", "title", "status"],
  defaultSort: "start",
  filters: ["status", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listAdminEvents>>["items"][number];

export default async function AdminEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as EventStatus)
    ? (query.filters.status as EventStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listAdminEvents({
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
      key: "title",
      header: "Title",
      sortKey: "title",
      sortDir: "asc",
      cell: (e) => (
        <FormPanelTrigger
          label={localize(e.title, "en") || "(untitled)"}
          title="Edit event"
          description={e.slug}
        >
          <EventForm initial={editInitial(e)} />
        </FormPanelTrigger>
      ),
    },
    {
      key: "date",
      header: "Starts",
      sortKey: "start",
      cell: (e) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {e.startDate
            ? new Date(e.startDate).toLocaleDateString("en-GB")
            : "—"}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      cell: (e) => (e.location ? localize(e.location, "en") : "—"),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (e) => <StatusBadge>{e.status}</StatusBadge>,
    },
    {
      key: "created",
      header: "Created",
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
      className: "w-24",
      cell: (e) => (
        <span className="flex items-center justify-end gap-1">
          <DeleteRowButton
            endpoint={`/api/admin/events/${String(e._id)}`}
            title={localize(e.title, "en")}
          />
          <RowActions
            label={`Actions for ${localize(e.title, "en")}`}
            actions={[
              {
                label: "Edit event",
                icon: "edit",
                panel: {
                  title: "Edit event",
                  description: e.slug,
                  content: <EventForm initial={editInitial(e)} />,
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
        title="Events"
        description="Conferences, webinars, and company milestones."
        action={
          <FormPanelButton
            label="New event"
            title="New event"
            description="Something happening, listed on the events page."
          >
            <EventForm />
          </FormPanelButton>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search event title or location…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "start", label: "Start date" },
            { value: "date", label: "Created" },
            { value: "title", label: "Title", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} event${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(e) => String(e._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={filtered ? "No events match these filters." : "No events yet."}
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Create the first event with the New event button; it stays a draft until you publish it."
        }
        emptyAction={
          filtered ? undefined : (
            <FormPanelButton
              label="New event"
              title="New event"
              description="Something happening, listed on the events page."
              icon={false}
            >
              <EventForm />
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
        noun="events"
      />
    </div>
  );
}
