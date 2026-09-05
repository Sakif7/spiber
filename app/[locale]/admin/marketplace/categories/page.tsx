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

export default async function AdminMarketplaceCategoriesPage({
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
      listCategoryTree("marketplace"),
      listCategories("marketplace"),
    ]);
    nodes = tree.map(toTreeNode);
    parents = flat.map((c) => ({
      id: String(c._id),
      name: localize(c.name, "en"),
    }));
  } catch {
    nodes = [];
    parents = [];
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Spiber Kart categories"
        description="The order here drives the storefront category grid, the shop sidebar and the “Shop by category” navigation menu."
      />

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-sm">
            {parents.length} categor{parents.length === 1 ? "y" : "ies"}
          </CardTitle>
          <CardDescription>
            Reorder with the arrows, or use Rename to change a name and slug.
          </CardDescription>
        </CardHeader>
        <CategoryTree nodes={nodes} />
      </Card>

      <Card className="max-w-[560px]">
        <CardHeader>
          <CardTitle className="text-sm">New category</CardTitle>
          <CardDescription>
            New categories are appended to the end of their parent’s order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryForm storefront="marketplace" parents={parents} />
        </CardContent>
      </Card>
    </div>
  );
}
