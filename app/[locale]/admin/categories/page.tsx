import { setRequestLocale } from "next-intl/server";
import { CategoryForm } from "@/components/admin/category-form";
import { CategoryTree, type TreeNode } from "@/components/admin/category-tree";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listCategoryTree,
  listCategories,
  type CategoryNode,
} from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

function toTreeNode(n: CategoryNode): TreeNode {
  return {
    id: String(n._id),
    nameEn: n.name?.en ?? "",
    nameBn: n.name?.bn,
    slug: n.slug,
    parentId: n.parentId ? String(n.parentId) : null,
    position: n.position,
    children: n.children.map(toTreeNode),
  };
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let nodes: TreeNode[] = [];
  let parents: { id: string; name: string }[] = [];
  try {
    const [tree, flat] = await Promise.all([
      listCategoryTree("instruments"),
      listCategories("instruments"),
    ]);
    nodes = tree.map(toTreeNode);
    // Only top-level categories can be parents (the tree is two levels deep).
    parents = flat
      .filter((c) => !c.parentId)
      .map((c) => ({ id: String(c._id), name: localize(c.name, "en") }));
  } catch {
    nodes = [];
    parents = [];
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Medtrade categories"
        description="The first category shows first in the navigation menu. Products live on leaf subcategories; a top category lists its whole subtree."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card className="order-2 gap-0 overflow-hidden py-0 lg:order-1">
          <CardHeader className="border-b px-4 py-3">
            <CardTitle className="text-sm">Category tree</CardTitle>
            <CardDescription>
              Reorder with the up/down arrows; choose a parent to nest a
              subcategory.
            </CardDescription>
          </CardHeader>
          <CategoryTree nodes={nodes} storefront="instruments" />
        </Card>

        <Card className="order-1 lg:order-2">
          <CardHeader>
            <CardTitle className="text-sm">New category</CardTitle>
            <CardDescription>
              Leave the parent empty to create a top-level category.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryForm storefront="instruments" parents={parents} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
