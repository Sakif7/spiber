import { setRequestLocale } from "next-intl/server";
import { listAdminAlbums } from "@/lib/repositories/gallery.repo";
import { localize } from "@/lib/schemas/localized";
import { galleryStatusEnum, type GalleryStatus } from "@/lib/schemas/gallery";
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
  AlbumForm,
  type AlbumFormInitial,
} from "@/components/admin/gallery/album-form";
import { FormPanelTrigger } from "@/components/admin/ui/form-panel";

export const dynamic = "force-dynamic";

const L = (v?: { en?: string; bn?: string }) => ({
  en: v?.en ?? "",
  bn: v?.bn ?? "",
});

/** The list already holds the whole album, so the edit panel prefills
    straight from the row. */
const editInitial = (album: Row): AlbumFormInitial => ({
  id: String(album._id),
  title: L(album.title),
  slug: album.slug,
  description: L(album.description),
  coverImage: album.coverImage ?? "",
  date: album.date ? new Date(album.date).toISOString().slice(0, 10) : "",
  images: (album.images ?? []).map((im) => ({
    url: im.url,
    caption: L(im.caption),
  })),
  status: album.status,
});

const STATUSES = galleryStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "title", "status", "albumDate"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listAdminAlbums>>["items"][number];

export default async function AdminGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as GalleryStatus)
    ? (query.filters.status as GalleryStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listAdminAlbums({
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
      cell: (a) => (
        <FormPanelTrigger
          label={localize(a.title, "en") || "(untitled)"}
          title="Edit album"
          description={a.slug}
        >
          <AlbumForm initial={editInitial(a)} />
        </FormPanelTrigger>
      ),
    },
    {
      key: "photos",
      header: "Photos",
      align: "right",
      cell: (a) => (
        <span className="tabular-nums">{a.images?.length ?? 0}</span>
      ),
    },
    {
      key: "date",
      header: "Album date",
      sortKey: "albumDate",
      cell: (a) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {a.date ? new Date(a.date).toLocaleDateString("en-GB") : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (a) => <StatusBadge>{a.status}</StatusBadge>,
    },
    {
      key: "created",
      header: "Created",
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
      className: "w-24",
      cell: (a) => (
        <span className="flex items-center justify-end gap-1">
          <DeleteRowButton
            endpoint={`/api/admin/gallery/${String(a._id)}`}
            title={localize(a.title, "en")}
          />
          <RowActions
            label={`Actions for ${localize(a.title, "en")}`}
            actions={[
              {
                label: "Edit album",
                icon: "edit",
                panel: {
                  title: "Edit album",
                  description: a.slug,
                  content: <AlbumForm initial={editInitial(a)} />,
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
        title="Gallery"
        description="Photo albums for company events and milestones."
        action={
          <FormPanelButton
            label="New album"
            title="New album"
            description="A set of photographs shown in the gallery."
          >
            <AlbumForm />
          </FormPanelButton>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search album title…" }}
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
            { value: "date", label: "Created" },
            { value: "albumDate", label: "Album date" },
            { value: "title", label: "Title", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} album${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={filtered ? "No albums match these filters." : "No albums yet."}
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Create the first album with the New album button; it stays a draft until you publish it."
        }
        emptyAction={
          filtered ? undefined : (
            <FormPanelButton
              label="New album"
              title="New album"
              description="A set of photographs shown in the gallery."
              icon={false}
            >
              <AlbumForm />
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
        noun="albums"
      />
    </div>
  );
}
