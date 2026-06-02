import { setRequestLocale } from "next-intl/server";

import { ProductForm } from "@/components/admin/product-form";
import { listBrands, listCategories } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

type Option = { id: string; name: string };

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let categories: Option[] = [];
  try {
    const rows = await listCategories();
    categories = rows.map((c) => ({
      id: String(c._id),
      name: localize(c.name, "en"),
    }));
  } catch {
    categories = [];
  }

  let brands: Option[] = [];
  try {
    const rows = await listBrands();
    brands = rows.map((b) => ({
      id: String(b._id),
      name: localize(b.name, "en"),
    }));
  } catch {
    brands = [];
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-6)",
      }}
    >
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
      <ProductForm categories={categories} brands={brands} />
    </div>
  );
}
