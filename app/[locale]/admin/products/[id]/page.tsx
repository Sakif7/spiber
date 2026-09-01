import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getProductById } from "@/lib/repositories/products.repo";
import { listCategories, listBrands } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { Link } from "@/i18n/navigation";
import {
  ProductForm,
  type ProductFormInitial,
} from "@/components/admin/product-form";

export const dynamic = "force-dynamic";

type Option = { id: string; name: string };
type CatOption = { id: string; name: string; parentId: string | null };

export default async function EditProductPage({
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
    const cats = await listCategories("instruments");
    categories = cats.map((c) => ({
      id: String(c._id),
      name: localize(c.name, "en"),
      parentId: c.parentId ? String(c.parentId) : null,
    }));
  } catch {
    categories = [];
  }
  try {
    const brs = await listBrands();
    brands = brs.map((b) => ({
      id: String(b._id),
      name: localize(b.name, "en"),
    }));
  } catch {
    brands = [];
  }

  const initial: ProductFormInitial = {
    id: String(p._id),
    sku: p.sku,
    slug: p.slug,
    name: { en: p.name?.en ?? "", bn: p.name?.bn },
    description: p.description
      ? { en: p.description.en ?? "", bn: p.description.bn }
      : undefined,
    categoryId: String(p.categoryId),
    brandId: p.brandId ? String(p.brandId) : undefined,
    priceMinor: p.priceMinor ?? undefined,
    floorPriceMinor: p.floorPriceMinor ?? null,
    lowStockThreshold: p.lowStockThreshold,
    status: p.status,
    specs: (p.specs ?? []).map(
      (s: {
        key: { en: string; bn?: string };
        value: { en: string; bn?: string };
      }) => ({
        key: { en: s.key?.en ?? "", bn: s.key?.bn },
        value: { en: s.value?.en ?? "", bn: s.value?.bn },
      }),
    ),
    images: p.images ?? [],
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: "var(--s-2)" }}>
        <Link
          href="/admin/products"
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          ← Products
        </Link>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-h2)",
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          {localize(p.name, "en") || p.sku}
        </h1>
        <p
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
            margin: 0,
          }}
        >
          SKU {p.sku}
        </p>
      </div>

      <ProductForm initial={initial} categories={categories} brands={brands} />
    </div>
  );
}
