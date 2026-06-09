import { setRequestLocale } from "next-intl/server";
import { CtaButton } from "@/components/ui/cta-button";
import { Link } from "@/i18n/navigation";
import { DeleteRowButton } from "@/components/admin/delete-row-button";
import { listAdminAlbums } from "@/lib/repositories/gallery.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Awaited<ReturnType<typeof listAdminAlbums>>["items"] = [];
  try {
    rows = (await listAdminAlbums({ pageSize: 100 })).items;
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
          Gallery
        </h1>
        <CtaButton href="/admin/gallery/new">New album</CtaButton>
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
            No albums yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Title</th>
                <th style={th}>Photos</th>
                <th style={th}>Date</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={String(a._id)}>
                  <td style={{ ...td, color: "var(--color-text-strong)" }}>
                    <Link
                      href={`/admin/gallery/${String(a._id)}`}
                      style={{ color: "inherit" }}
                    >
                      {localize(a.title, "en")}
                    </Link>
                  </td>
                  <td style={td}>{a.images?.length ?? 0}</td>
                  <td style={td}>
                    {a.date ? new Date(a.date).toLocaleDateString() : "—"}
                  </td>
                  <td style={td}>{a.status}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        gap: "var(--s-2)",
                        alignItems: "center",
                      }}
                    >
                      <Link
                        href={`/admin/gallery/${String(a._id)}`}
                        style={{
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--r-sm)",
                          color: "var(--color-brand-deep)",
                          padding: "4px 10px",
                          fontSize: "var(--fs-small)",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        Edit
                      </Link>
                      <DeleteRowButton
                        endpoint={`/api/admin/gallery/${String(a._id)}`}
                        title={localize(a.title, "en")}
                      />
                    </div>
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
