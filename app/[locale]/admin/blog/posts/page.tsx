import { setRequestLocale } from "next-intl/server";
import { CtaButton } from "@/components/ui/cta-button";
import { Link } from "@/i18n/navigation";
import { PostDeleteButton } from "@/components/admin/blog/post-editor";
import { listAdminPosts } from "@/lib/repositories/blog.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

export default async function AdminBlogPostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Awaited<ReturnType<typeof listAdminPosts>>["items"] = [];
  try {
    rows = (await listAdminPosts({ pageSize: 100 })).items;
  } catch {
    rows = [];
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-3)",
          flexWrap: "wrap",
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
          Posts
        </h1>
        <CtaButton href="/admin/blog/posts/new">New post</CtaButton>
      </div>

      <section
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "var(--color-surface)",
          overflow: "hidden",
        }}
      >
        {rows.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "var(--s-6)",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            No posts yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Title</th>
                <th style={th}>Status</th>
                <th style={th}>Published</th>
                <th style={th}>Views</th>
                <th style={{ ...th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={String(p._id)}>
                  <td style={{ ...td, color: "var(--color-text-strong)" }}>
                    <Link
                      href={`/admin/blog/posts/${String(p._id)}`}
                      style={{ color: "inherit" }}
                    >
                      {localize(p.title, "en")}
                    </Link>
                  </td>
                  <td style={td}>{p.status}</td>
                  <td style={td}>
                    {p.publishedAt
                      ? new Date(p.publishedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td style={td}>{p.viewCount}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <PostDeleteButton
                      id={String(p._id)}
                      title={localize(p.title, "en")}
                    />
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
