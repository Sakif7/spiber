import { setRequestLocale } from "next-intl/server";
import { listAdminPosts } from "@/lib/repositories/blog.repo";
import {
  listBlogCategories,
  listBlogTags,
} from "@/lib/repositories/blogTaxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { blogStatusEnum, type BlogStatus } from "@/lib/schemas/blog";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { PostDeleteButton } from "@/components/admin/blog/post-editor";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions } from "@/components/admin/ui/row-actions";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { PostEditor } from "@/components/admin/blog/post-editor";
import { PostEditorPanel } from "@/components/admin/blog/post-editor-panel";
import { FormPanelTrigger } from "@/components/admin/ui/form-panel";

export const dynamic = "force-dynamic";

const STATUSES = blogStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "title", "status", "published", "views"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listAdminPosts>>["items"][number];

export default async function AdminBlogPostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as BlogStatus)
    ? (query.filters.status as BlogStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listAdminPosts({
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

  // The new-post panel writes against the same taxonomy the editor page
  // used to load for itself.
  const [cats, tagRows] = await Promise.all([
    listBlogCategories().catch(() => []),
    listBlogTags().catch(() => []),
  ]);
  const categories = cats.map((c) => ({
    id: String(c._id),
    name: localize(c.name, "en"),
  }));
  const tags = tagRows.map((t) => ({
    id: String(t._id),
    name: localize(t.name, "en"),
  }));

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Title",
      sortKey: "title",
      sortDir: "asc",
      cell: (p) => (
        <FormPanelTrigger
          label={localize(p.title, "en") || "(untitled)"}
          title="Edit post"
          description={p.slug}
        >
          <PostEditorPanel
            id={String(p._id)}
            categories={categories}
            tags={tags}
          />
        </FormPanelTrigger>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (p) => <StatusBadge>{p.status}</StatusBadge>,
    },
    {
      key: "published",
      header: "Published",
      sortKey: "published",
      cell: (p) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {p.publishedAt
            ? new Date(p.publishedAt).toLocaleDateString("en-GB")
            : "—"}
        </span>
      ),
    },
    {
      key: "views",
      header: "Views",
      align: "right",
      sortKey: "views",
      cell: (p) => <span className="tabular-nums">{p.viewCount}</span>,
    },
    {
      key: "date",
      header: "Created",
      align: "right",
      sortKey: "date",
      cell: (p) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(p.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-24",
      cell: (p) => (
        <span className="flex items-center justify-end gap-1">
          <PostDeleteButton
            id={String(p._id)}
            title={localize(p.title, "en")}
          />
          <RowActions
            label={`Actions for ${localize(p.title, "en")}`}
            actions={[
              {
                label: "Edit post",
                icon: "edit",
                panel: {
                  title: "Edit post",
                  description: p.slug,
                  content: (
                    <PostEditorPanel
                      id={String(p._id)}
                      categories={categories}
                      tags={tags}
                    />
                  ),
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
        title="Blog posts"
        description="Blog articles — drafts, scheduled, and published."
        action={
          <FormPanelButton
            label="New post"
            title="New post"
            description="A blog article — it stays a draft until you publish it."
          >
            <PostEditor categories={categories} tags={tags} />
          </FormPanelButton>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search post title…" }}
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
            { value: "published", label: "Published" },
            { value: "views", label: "Views" },
            { value: "title", label: "Title", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} post${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(p) => String(p._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={filtered ? "No posts match these filters." : "No posts yet."}
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Write the first article with the New post button; it stays a draft until you publish it."
        }
        emptyAction={
          filtered ? undefined : (
            <FormPanelButton
              label="New post"
              title="New post"
              description="A blog article — it stays a draft until you publish it."
              icon={false}
            >
              <PostEditor categories={categories} tags={tags} />
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
        noun="posts"
      />
    </div>
  );
}
