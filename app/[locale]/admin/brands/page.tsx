import { setRequestLocale } from "next-intl/server";

import { BrandForm } from "@/components/admin/brand-form";
import { BrandList, type BrandRow } from "@/components/admin/brand-list";
import { listBrands } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let brands: BrandRow[] = [];
  try {
    const rows = await listBrands();
    brands = rows.map((b) => ({
      id: String(b._id),
      nameEn: localize(b.name, "en"),
      nameBn: b.name?.bn ?? "",
      slug: b.slug,
    }));
  } catch {
    brands = [];
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
          }}
        >
          Brands
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-small)",
          }}
        >
          Reorder with the up/down arrows — the order here drives brand filters
          and the “By brand” navigation menu.
        </p>
      </div>

      <section
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "var(--color-surface)",
          padding: "var(--s-5)",
        }}
      >
        <h2
          style={{
            margin: "0 0 var(--s-4)",
            fontSize: "var(--fs-h4)",
            color: "var(--color-text-strong)",
          }}
        >
          Add brand
        </h2>
        <BrandForm />
      </section>

      <section
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "var(--color-surface)",
          overflow: "hidden",
        }}
      >
        <BrandList brands={brands} />
      </section>
    </div>
  );
}
