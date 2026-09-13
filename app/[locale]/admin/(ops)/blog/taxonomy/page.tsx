import { setRequestLocale } from "next-intl/server";
import { FolderTree, Tags } from "lucide-react";
import {
  BlogCategoryForm,
  BlogTagForm,
  TaxonomyDeleteButton,
} from "@/components/admin/blog/taxonomy-forms";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listBlogCategories,
  listBlogTags,
} from "@/lib/repositories/blogTaxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

type TaxonomyRow = { id: string; name: string; slug: string };

function columns(kind: "categories" | "tags"): Column<TaxonomyRow>[] {
  return [
    {
      key: "name",
      header: "Name",
      cell: (r) => (
        <span className="text-foreground font-medium">{r.name}</span>
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
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-24",
      cell: (r) => <TaxonomyDeleteButton kind={kind} id={r.id} name={r.name} />,
    },
  ];
}

export default async function AdminBlogTaxonomyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [cats, tags] = await Promise.all([
    listBlogCategories().catch(() => []),
    listBlogTags().catch(() => []),
  ]);

  const catRows: TaxonomyRow[] = cats.map((c) => ({
    id: String(c._id),
    name: localize(c.name, "en"),
    slug: c.slug,
  }));
  const tagRows: TaxonomyRow[] = tags.map((t) => ({
    id: String(t._id),
    name: localize(t.name, "en"),
    slug: t.slug,
  }));

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Blog taxonomy"
        description="Categories group posts on the blog index; tags drive the related-posts rail and the tag archives."
      />

      <div className="grid items-start gap-6 md:grid-cols-2">
        {/* Categories */}
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add category</CardTitle>
              <CardDescription>
                English is required; the other locales fall back to it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BlogCategoryForm />
            </CardContent>
          </Card>
          <DataTable
            columns={columns("categories")}
            rows={catRows}
            getRowKey={(r) => r.id}
            minWidth={360}
            empty="No categories yet"
            emptyIcon={FolderTree}
            emptyDescription="Add a category above to group blog posts."
          />
        </div>

        {/* Tags */}
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add tag</CardTitle>
              <CardDescription>
                English is required; the other locales fall back to it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BlogTagForm />
            </CardContent>
          </Card>
          <DataTable
            columns={columns("tags")}
            rows={tagRows}
            getRowKey={(r) => r.id}
            minWidth={360}
            empty="No tags yet"
            emptyIcon={Tags}
            emptyDescription="Add a tag above to power the related-posts rail."
          />
        </div>
      </div>
    </div>
  );
}
