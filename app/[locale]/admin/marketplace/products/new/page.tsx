import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MarketplaceProductForm } from "@/components/admin/marketplace-product-form";
import { listBrands, listCategories } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

type Option = { id: string; name: string };
type CatOption = { id: string; name: string; parentId: string | null };

export default async function NewMarketplaceProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let categories: CatOption[] = [];
  let brands: Option[] = [];
  try {
    const [cats, brs] = await Promise.all([
      listCategories("marketplace"),
      listBrands(),
    ]);
    categories = cats.map((c) => ({
      id: String(c._id),
      name: localize(c.name, "en"),
      parentId: c.parentId ? String(c.parentId) : null,
    }));
    brands = brs.map((b) => ({
      id: String(b._id),
      name: localize(b.name, "en"),
    }));
  } catch {
    categories = [];
    brands = [];
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: "var(--s-2)" }}>
        <Link
          href="/admin/marketplace/products"
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          ← Marketplace products
        </Link>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
          }}
        >
          New product
        </h1>
      </div>
      <MarketplaceProductForm categories={categories} brands={brands} />
    </div>
  );
}
