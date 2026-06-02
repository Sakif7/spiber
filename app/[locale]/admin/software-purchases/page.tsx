import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPurchases } from "@/lib/repositories/purchases.repo";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminPurchasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Awaited<ReturnType<typeof listPurchases>>["items"] = [];
  try {
    rows = (await listPurchases({ pageSize: 100 })).items;
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
        Software purchases
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
            No purchases yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Reference</th>
                <th style={th}>Product</th>
                <th style={th}>Email</th>
                <th style={th}>Total</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={String(p._id)}>
                  <td style={{ ...td, fontFamily: "var(--font-mono)" }}>
                    <Link
                      href={`/admin/software-purchases/${String(p._id)}`}
                      style={{ color: "var(--color-brand-deep)" }}
                    >
                      {p.purchaseNumber}
                    </Link>
                  </td>
                  <td style={td}>{localize(p.productSnapshot.name, "en")}</td>
                  <td style={td}>{p.email}</td>
                  <td style={td}>{formatBDT(p.totalMinor, "en")}</td>
                  <td style={td}>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
