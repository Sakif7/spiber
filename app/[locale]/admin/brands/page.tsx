import { setRequestLocale } from "next-intl/server";

import { BrandForm, BrandDeleteButton } from "@/components/admin/brand-form";
import { listBrands } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

type BrandRow = { id: string; nameEn: string; nameBn: string; slug: string };

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

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "var(--s-3) var(--s-4)",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--fs-caption)",
    color: "var(--color-text-muted)",
    fontWeight: 500,
    borderBottom: "1px solid var(--color-border)",
  };
  const td: React.CSSProperties = {
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-small)",
    color: "var(--color-text)",
    borderBottom: "1px solid var(--color-border)",
    verticalAlign: "middle",
  };

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
        Brands
      </h1>

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
        {brands.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "var(--s-6)",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            No brands yet.
          </p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={th}>Name (EN)</th>
                <th style={th}>Name (BN)</th>
                <th style={th}>Slug</th>
                <th style={{ ...th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id}>
                  <td style={{ ...td, color: "var(--color-text-strong)" }}>
                    {b.nameEn}
                  </td>
                  <td style={td}>{b.nameBn || "—"}</td>
                  <td style={{ ...td, fontFamily: "var(--font-mono)" }}>
                    {b.slug}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <BrandDeleteButton id={b.id} name={b.nameEn} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
