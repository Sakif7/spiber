import { setRequestLocale } from "next-intl/server";

import {
  CategoryForm,
  DeleteCategoryButton,
} from "@/components/admin/category-form";
import { listCategories } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

type CategoryRow = { id: string; nameEn: string; nameBn: string; slug: string };

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let categories: CategoryRow[] = [];
  try {
    const rows = await listCategories();
    categories = rows.map((c) => ({
      id: String(c._id),
      nameEn: localize(c.name, "en"),
      nameBn: c.name?.bn ?? "",
      slug: c.slug,
    }));
  } catch {
    categories = [];
  }

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-small)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    borderBottom: "1px solid var(--color-border)",
  };
  const td: React.CSSProperties = {
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-base)",
    color: "var(--color-text)",
    borderBottom: "1px solid var(--color-border)",
    verticalAlign: "middle",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-6)",
        padding: "var(--s-6)",
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
        Categories
      </h1>

      <section
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        {categories.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "var(--s-6)",
              color: "var(--color-text-muted)",
              fontSize: "var(--fs-base)",
            }}
          >
            No categories yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Slug</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td style={td}>
                    <span style={{ color: "var(--color-text-strong)" }}>
                      {c.nameEn}
                    </span>
                    {c.nameBn && (
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {" "}
                        · {c.nameBn}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      ...td,
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {c.slug}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <DeleteCategoryButton id={c.id} name={c.nameEn} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
        <CategoryForm />
      </section>
    </div>
  );
}
