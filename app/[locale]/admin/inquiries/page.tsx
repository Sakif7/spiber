import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listInquiries } from "@/lib/repositories/inquiries.repo";

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Awaited<ReturnType<typeof listInquiries>>["items"] = [];
  try {
    rows = (await listInquiries({ pageSize: 100 })).items;
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
        Inquiries
      </h1>
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
            No inquiries yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Reference</th>
                <th style={th}>Division</th>
                <th style={th}>Name</th>
                <th style={th}>Subject</th>
                <th style={th}>Status</th>
                <th style={th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={String(q._id)}>
                  <td style={{ ...td, fontFamily: "var(--font-mono)" }}>
                    <Link
                      href={`/admin/inquiries/${String(q._id)}`}
                      style={{ color: "var(--color-brand-deep)" }}
                    >
                      {q.inquiryNumber}
                    </Link>
                  </td>
                  <td style={td}>{q.division}</td>
                  <td style={td}>{q.name}</td>
                  <td style={td}>{q.subject ?? "—"}</td>
                  <td style={td}>{q.status}</td>
                  <td style={td}>
                    {new Date(q.createdAt).toLocaleDateString()}
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
