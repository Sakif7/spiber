import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import {
  ListToolbar,
  type FilterDef,
} from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions } from "@/components/admin/ui/row-actions";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import type { ListConfig, ListQuery } from "@/lib/admin/list-params";
import { tourismStatusEnum } from "@/lib/schemas/tourism-catalog";

export type CatalogRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  /** ISO date. */
  createdAt: string;
  /** Optional secondary descriptor (category, country, hospital…). */
  meta?: string;
};

/** The list config every tourism catalog page shares (extra filters appended). */
export const CATALOG_LIST: ListConfig = {
  sortable: ["date", "name", "status"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

/**
 * Standard tourism-catalog list (destinations, hospitals, doctors, packages):
 * the shared toolbar (search · status pills · extra filters · date range ·
 * sort), the table (name → edit page, slug, optional meta, status, created)
 * and pagination. Pages parse the URL, load rows and hand everything here.
 */
export function CatalogList({
  rows,
  base,
  noun,
  nounSingular,
  metaHeader,
  query,
  total,
  pages,
  filters = [],
  searchPlaceholder,
  emptyHint,
}: {
  rows: CatalogRow[];
  base: string;
  /** Plural, lowercase, e.g. "destinations". */
  noun: string;
  /** Singular for the New button, e.g. "destination". */
  nounSingular: string;
  /** Header for the optional meta column (omitted when not given). */
  metaHeader?: string;
  query: ListQuery;
  total: number;
  pages: number;
  /** Extra filters rendered after the status pills. */
  filters?: FilterDef[];
  searchPlaceholder: string;
  /** Unfiltered empty-state explanation. */
  emptyHint: string;
}) {
  const filtered = Boolean(
    query.q || Object.values(query.filters).some(Boolean),
  );

  const columns: Column<CatalogRow>[] = [
    {
      key: "title",
      header: "Name",
      sortKey: "name",
      sortDir: "asc",
      cell: (r) => (
        <Link
          href={`${base}/${r.id}`}
          className="text-primary font-medium hover:underline"
        >
          {r.title || "(untitled)"}
        </Link>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      cell: (r) => (
        <span className="text-muted-foreground font-mono text-xs">
          {r.slug}
        </span>
      ),
    },
    ...(metaHeader
      ? [
          {
            key: "meta",
            header: metaHeader,
            cell: (r: CatalogRow) => (
              <span className="text-muted-foreground">{r.meta ?? "—"}</span>
            ),
          } satisfies Column<CatalogRow>,
        ]
      : []),
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (r) => <StatusBadge>{r.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Created",
      align: "right",
      sortKey: "date",
      cell: (r) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(r.createdAt).toLocaleDateString("en-GB")}
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
          label={`Actions for ${r.title}`}
          actions={[{ label: "Edit", href: `${base}/${r.id}`, icon: "edit" }]}
        />
      ),
    },
  ];

  return (
    <>
      <ListToolbar
        search={{ placeholder: searchPlaceholder }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: tourismStatusEnum.options.map((s) => ({
              value: s,
              label: s,
            })),
          },
          ...filters,
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Created" },
            { value: "name", label: "Name", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} ${total === 1 ? nounSingular : noun}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        sort={{ key: query.sort, dir: query.dir }}
        empty={filtered ? `No ${noun} match these filters.` : `No ${noun} yet.`}
        emptyDescription={
          filtered ? "Try clearing the search or a filter." : emptyHint
        }
        emptyAction={
          filtered ? undefined : (
            <Button asChild size="sm">
              <Link href={`${base}/new`}>New {nounSingular}</Link>
            </Button>
          )
        }
        minWidth={720}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun={noun}
      />
    </>
  );
}
