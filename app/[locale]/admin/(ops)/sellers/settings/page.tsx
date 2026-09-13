import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { listCategoryTree } from "@/lib/repositories/taxonomy.repo";
import { getSellerCommissionBp } from "@/lib/services/seller-settings.service";
import { localize } from "@/lib/schemas/localized";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { SellerSettingsForm } from "@/components/admin/seller-settings-form";
import type { ICategory } from "@/lib/models/category";
import type { Lean } from "@/lib/models/_shared";

export const dynamic = "force-dynamic";

type Node = Lean<ICategory> & { children: Node[] };

export default async function AdminSellerSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  let globalBp = 1000;
  try {
    globalBp = await getSellerCommissionBp();
  } catch {
    globalBp = 1000;
  }

  let tree: Node[] = [];
  try {
    tree = (await listCategoryTree("marketplace")) as unknown as Node[];
  } catch {
    tree = [];
  }

  // Flatten the tree with depth so the form can indent subcategories.
  const rows: { id: string; name: string; depth: number; rate: string }[] = [];
  const walk = (nodes: Node[], depth: number) => {
    for (const n of nodes) {
      rows.push({
        id: String(n._id),
        name: localize(n.name, loc),
        depth,
        rate:
          typeof n.sellerCommissionBp === "number"
            ? String(n.sellerCommissionBp / 100)
            : "",
      });
      if (n.children?.length) walk(n.children, depth + 1);
    }
  };
  walk(tree, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Seller settings"
        description="The platform commission (Spiber cut) and per-category rates."
      />
      <SellerSettingsForm
        initialGlobalPct={String(globalBp / 100)}
        categories={rows}
      />
    </div>
  );
}
