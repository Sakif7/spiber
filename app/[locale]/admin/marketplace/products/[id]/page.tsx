import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getProductById } from "@/lib/repositories/products.repo";
import { listCategories, listBrands } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import {
  MarketplaceProductForm,
  type MarketplaceProductInitial,
} from "@/components/admin/marketplace-product-form";

export const dynamic = "force-dynamic";

type Option = { id: string; name: string };
type CatOption = { id: string; name: string; parentId: string | null };

export default async function EditMarketplaceProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const doc = await getProductById(id);
  if (!doc) notFound();
  const p = doc.toObject();

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

  const initial: MarketplaceProductInitial = {
    id: String(p._id),
    sku: p.sku,
    slug: p.slug,
    name: { en: p.name?.en ?? "", bn: p.name?.bn },
    description: p.description
      ? { en: p.description.en ?? "", bn: p.description.bn }
      : undefined,
    categoryId: String(p.categoryId),
    brandId: p.brandId ? String(p.brandId) : undefined,
    priceMinor: p.priceMinor,
    compareAtMinor: p.compareAtMinor ?? null,
    lowStockThreshold: p.lowStockThreshold,
    status: p.status,
    featured: p.featured,
    specs: (p.specs ?? []).map((s) => ({
      key: { en: s.key?.en ?? "", bn: s.key?.bn },
      value: { en: s.value?.en ?? "", bn: s.value?.bn },
    })),
    images: p.images ?? [],
    variantOptions: (p.variantOptions ?? []).map((o) => ({
      name: { en: o.name.en, bn: o.name.bn },
      values: o.values.map((v) => ({ en: v.en, bn: v.bn })),
    })),
    variants: (p.variants ?? []).map((v) => ({
      id: v.id,
      options: v.options,
      sku: v.sku,
      priceMinorOverride: v.priceMinorOverride ?? null,
      stockQty: v.stockQty,
    })),
  };

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
          ← Spiber Kart products
        </Link>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-h2)",
            color: "var(--color-text-strong)",
          }}
        >
          {localize(p.name, "en") || p.sku}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          SKU {p.sku}
        </p>
      </div>
      <MarketplaceProductForm
        initial={initial}
        categories={categories}
        brands={brands}
      />
    </div>
  );
}
