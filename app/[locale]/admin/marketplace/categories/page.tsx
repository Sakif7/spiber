import { setRequestLocale } from "next-intl/server";
import { CategoryForm } from "@/components/admin/category-form";
import { CategoryTree, type TreeNode } from "@/components/admin/category-tree";
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
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-2xl)",
          color: "var(--color-text-strong)",
        }}
      >
        Marketplace categories
      </h1>

      <section
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <CategoryTree nodes={nodes} />
      </section>

      <section
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-6)",
          maxWidth: 560,
        }}
      >
        <h2
          style={{
            margin: "0 0 var(--s-4)",
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-lg)",
            color: "var(--color-text-strong)",
          }}
        >
          New category
        </h2>
        <CategoryForm storefront="marketplace" parents={parents} />
      </section>
    </div>
  );
}
