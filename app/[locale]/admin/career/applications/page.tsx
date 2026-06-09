import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DeleteRowButton } from "@/components/admin/delete-row-button";
import { ApplicationStatusSelect } from "@/components/admin/career/application-status";
import { listApplications } from "@/lib/repositories/career.repo";

export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Awaited<ReturnType<typeof listApplications>>["items"] = [];
  try {
    rows = (await listApplications({ pageSize: 100 })).items;
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
          Applications
        </h1>
        <Link
          href="/admin/career"
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-sm)",
            color: "var(--color-brand-deep)",
            padding: "8px 14px",
            fontSize: "var(--fs-small)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ← Jobs
        </Link>
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
            No applications yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Applicant</th>
                <th style={th}>Role</th>
                <th style={th}>Status</th>
                <th style={th}>Applied</th>
                <th style={{ ...th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={String(a._id)}>
                  <td style={{ ...td, color: "var(--color-text-strong)" }}>
                    <Link
                      href={`/admin/career/applications/${String(a._id)}`}
                      style={{ color: "inherit", fontWeight: 600 }}
                    >
                      {a.name}
                    </Link>
                    <div
                      style={{
                        color: "var(--color-text-muted)",
                        fontSize: "var(--fs-caption)",
                      }}
                    >
                      {a.email}
                    </div>
                  </td>
                  <td style={td}>{a.jobTitle ?? "—"}</td>
                  <td style={td}>
                    <ApplicationStatusSelect
                      id={String(a._id)}
                      status={a.status}
                    />
                  </td>
                  <td style={td}>
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        gap: "var(--s-2)",
                        alignItems: "center",
                      }}
                    >
                      <a
                        href={`/api/admin/career/applications/${String(a._id)}/resume`}
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
                        Résumé
                      </a>
                      <DeleteRowButton
                        endpoint={`/api/admin/career/applications/${String(a._id)}`}
                        title={a.name}
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
