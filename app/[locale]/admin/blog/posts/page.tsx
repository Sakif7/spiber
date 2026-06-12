import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { PostDeleteButton } from "@/components/admin/blog/post-editor";
import { listAdminPosts } from "@/lib/repositories/blog.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listAdminPosts>>["items"][number];

export default async function AdminBlogPostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = (await listAdminPosts({ pageSize: 100 })).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Title",
      cell: (p) => (
        <Link
          href={`/admin/blog/posts/${String(p._id)}`}
          className="text-primary font-medium hover:underline"
        >
          {localize(p.title, "en")}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => <StatusBadge>{p.status}</StatusBadge>,
    },
    {
      key: "published",
      header: "Published",
      cell: (p) => (
        <span className="text-muted-foreground">
          {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "views",
      header: "Views",
      align: "right",
      cell: (p) => p.viewCount,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (p) => (
        <div className="inline-flex items-center gap-2">
          <Link
            href={`/admin/blog/posts/${String(p._id)}`}
            className="text-primary font-medium hover:underline"
          >
            Edit
          </Link>
          <PostDeleteButton
            id={String(p._id)}
            title={localize(p.title, "en")}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Posts"
        description="Blog articles — drafts, scheduled, and published."
        action={
          <Button asChild>
            <Link href="/admin/blog/posts/new">
              <Plus className="size-4" />
              New post
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(p) => String(p._id)}
        empty="No posts yet."
        minWidth={720}
      />
    </div>
  );
}
