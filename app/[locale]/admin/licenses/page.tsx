import { setRequestLocale } from "next-intl/server";
import { StatusRowActions } from "@/components/admin/status-row-actions";
import { listLicenses } from "@/lib/repositories/licenses.repo";

export const dynamic = "force-dynamic";

export default async function AdminLicensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Awaited<ReturnType<typeof listLicenses>> = [];
  try {
    rows = await listLicenses();
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
        Licenses
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
            No licenses issued yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Key</th>
                <th style={th}>Status</th>
                <th style={th}>Issued</th>
                <th style={{ ...th, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lic) => (
                <tr key={String(lic._id)}>
                  <td style={{ ...td, fontFamily: "var(--font-mono)" }}>
                    {lic.key}
                  </td>
                  <td style={td}>{lic.status}</td>
                  <td style={td}>
                    {new Date(lic.issuedAt).toLocaleDateString()}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <StatusRowActions
                      endpoint={`/api/admin/licenses/${String(lic._id)}`}
                      actions={
                        lic.status === "revoked"
                          ? [{ to: "active", label: "Reactivate" }]
                          : [{ to: "revoked", label: "Revoke", danger: true }]
                      }
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
