import { setRequestLocale } from "next-intl/server";
import {
  BlogCategoryForm,
  BlogTagForm,
  TaxonomyDeleteButton,
} from "@/components/admin/blog/taxonomy-forms";
import {
  listBlogCategories,
  listBlogTags,
} from "@/lib/repositories/blogTaxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

export default async function AdminBlogTaxonomyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [cats, tags] = await Promise.all([
    listBlogCategories().catch(() => []),
    listBlogTags().catch(() => []),
  ]);

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
  const card: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    borderRadius: "var(--r-lg)",
    background: "var(--color-surface)",
    padding: "var(--s-5)",
    display: "grid",
    gap: "var(--s-4)",
  };
  const h2: React.CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-h4)",
    color: "var(--color-text-strong)",
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
        Blog taxonomy
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--s-6)",
          alignItems: "start",
        }}
      >
        {/* Categories */}
        <div style={{ display: "grid", gap: "var(--s-4)" }}>
          <section style={card}>
            <h2 style={h2}>Categories</h2>
            <BlogCategoryForm />
          </section>
          <section
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              background: "var(--color-surface)",
              overflow: "hidden",
            }}
          >
            {cats.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: "var(--s-5)",
                  color: "var(--color-text-muted)",
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
                    <th style={{ ...th, textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cats.map((c) => (
                    <tr key={String(c._id)}>
                      <td style={{ ...td, color: "var(--color-text-strong)" }}>
                        {localize(c.name, "en")}
                      </td>
                      <td style={{ ...td, fontFamily: "var(--font-mono)" }}>
                        {c.slug}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <TaxonomyDeleteButton
                          kind="categories"
                          id={String(c._id)}
                          name={localize(c.name, "en")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        {/* Tags */}
        <div style={{ display: "grid", gap: "var(--s-4)" }}>
          <section style={card}>
            <h2 style={h2}>Tags</h2>
            <BlogTagForm />
          </section>
          <section
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              background: "var(--color-surface)",
              overflow: "hidden",
            }}
          >
            {tags.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: "var(--s-5)",
                  color: "var(--color-text-muted)",
                }}
              >
                No tags yet.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Name</th>
                    <th style={th}>Slug</th>
                    <th style={{ ...th, textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tg) => (
                    <tr key={String(tg._id)}>
                      <td style={{ ...td, color: "var(--color-text-strong)" }}>
                        {localize(tg.name, "en")}
                      </td>
                      <td style={{ ...td, fontFamily: "var(--font-mono)" }}>
                        {tg.slug}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <TaxonomyDeleteButton
                          kind="tags"
                          id={String(tg._id)}
                          name={localize(tg.name, "en")}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
