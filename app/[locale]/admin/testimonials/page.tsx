import { setRequestLocale } from "next-intl/server";
import { MessageSquareQuote } from "lucide-react";
import { listTestimonialsForAdminPaged } from "@/lib/repositories/testimonials.repo";
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
import {
  FormPanelButton,
  FormPanelTrigger,
} from "@/components/admin/ui/form-panel";
import {
  TestimonialForm,
  type TestimonialInitial,
} from "@/components/admin/testimonial-form";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  sortable: ["order", "date", "name", "category"],
  defaultSort: "order",
  defaultDir: "asc",
  filters: ["category", "published", "from", "to"],
};

type Row = {
  id: string;
  /** Everything the form needs — these records are small, so the list
      carries them and the edit panel opens without a round trip. */
  initial: TestimonialInitial;
  name: string;
  role: string;
  category: string;
  hasPhoto: boolean;
  order: number;
  published: boolean;
  createdAt: string;
};

export default async function AdminTestimonialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const category =
    query.filters.category === "general" || query.filters.category === "tourism"
      ? query.filters.category
      : undefined;
  const published =
    query.filters.published === "1"
      ? true
      : query.filters.published === "0"
        ? false
        : undefined;
  const filtered = Boolean(
    query.q || category || published !== undefined || query.filters.from,
  );

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listTestimonialsForAdminPaged({
      category,
      published,
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
    rows = res.items.map((d) => ({
      id: String(d._id),
      initial: {
        quote: d.quote,
        name: d.name,
        role: d.role ?? "",
        imageSrc: d.imageSrc ?? "",
        tone: d.tone ?? "teal",
        category: d.category ?? "general",
        order: d.order ?? 0,
        published: d.published !== false,
      },
      name: d.name,
      role: d.role ?? "",
      category: d.category ?? "general",
      hasPhoto: Boolean(d.imageSrc),
      order: d.order ?? 0,
      published: d.published !== false,
      // Testimonials written before the model gained timestamps carry no
      // createdAt; an Invalid Date would throw on toISOString().
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : "",
    }));
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Name",
      sortKey: "name",
      sortDir: "asc",
      cell: (r) => (
        <FormPanelTrigger
          label={r.name}
          title="Edit testimonial"
          description={r.role || undefined}
        >
          <TestimonialForm id={r.id} initial={r.initial} />
        </FormPanelTrigger>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (r) =>
        r.role ? r.role : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "category",
      header: "Section",
      sortKey: "category",
      sortDir: "asc",
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.category === "tourism" ? "Tourism" : "Homepage"}
        </span>
      ),
    },
    {
      key: "photo",
      header: "Photo",
      cell: (r) =>
        r.hasPhoto ? (
          <span className="text-[var(--tone-success-fg)]">✓</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "order",
      header: "Order",
      align: "right",
      sortKey: "order",
      sortDir: "asc",
      className: "font-mono text-muted-foreground",
      cell: (r) => r.order,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge>{r.published ? "Published" : "Draft"}</StatusBadge>
      ),
    },
    {
      key: "date",
      header: "Created",
      align: "right",
      sortKey: "date",
      cell: (r) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {r.createdAt
            ? new Date(r.createdAt).toLocaleDateString("en-GB")
            : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (r) => (
        <RowActions
          label={`Actions for ${r.name}`}
          actions={[
            {
              label: "Edit",
              icon: "edit",
              panel: {
                title: "Edit testimonial",
                description: r.role || undefined,
                content: <TestimonialForm id={r.id} initial={r.initial} />,
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
        title="Testimonials"
        description="Patient and partner voices shown on the homepage and the tourism hub."
        action={
          <FormPanelButton
            label="New testimonial"
            title="New testimonial"
            description="A patient or partner voice for the homepage or the tourism hub."
          >
            <TestimonialForm />
          </FormPanelButton>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search name or role…" }}
        filters={[
          {
            param: "category",
            label: "Section",
            kind: "pills",
            options: [
              { value: "general", label: "Homepage" },
              { value: "tourism", label: "Tourism" },
            ],
          },
          {
            param: "published",
            label: "Status",
            kind: "pills",
            options: [
              { value: "1", label: "Published" },
              { value: "0", label: "Draft" },
            ],
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "order", label: "Display order", defaultDir: "asc" },
            { value: "date", label: "Created" },
            { value: "name", label: "Name", defaultDir: "asc" },
            { value: "category", label: "Section", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} testimonial${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No testimonials match these filters."
            : "No testimonials yet."
        }
        emptyIcon={MessageSquareQuote}
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Add a patient or partner testimonial to feature it on the homepage or the tourism hub."
        }
        emptyAction={
          filtered ? undefined : (
            <FormPanelButton
              label="New testimonial"
              title="New testimonial"
              description="A patient or partner voice for the homepage or the tourism hub."
              icon={false}
            >
              <TestimonialForm />
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
        noun="testimonials"
      />
    </div>
  );
}
