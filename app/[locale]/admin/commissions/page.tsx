import { setRequestLocale } from "next-intl/server";
import {
  listCommissions,
  commissionTotals,
} from "@/lib/repositories/commissions.repo";
import { formatBDT } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminCommissionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Awaited<ReturnType<typeof listCommissions>> = [];
  let totals = { accruedMinor: 0, paidMinor: 0, voidMinor: 0 };
  try {
    [rows, totals] = await Promise.all([listCommissions(), commissionTotals()]);
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
        Affiliate commissions
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--s-4)",
        }}
      >
        {[
          { label: "Accrued", value: totals.accruedMinor },
          { label: "Paid", value: totals.paidMinor },
          { label: "Void", value: totals.voidMinor },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-lg)",
              background: "var(--color-surface)",
              padding: "var(--s-5)",
              display: "grid",
              gap: 4,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-caption)",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
              }}
            >
              {s.label}
            </span>
            <strong
              style={{
                fontSize: "var(--fs-h3)",
                color: "var(--color-text-strong)",
              }}
            >
              {formatBDT(s.value, "en")}
            </strong>
          </div>
        ))}
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
            No commissions recorded yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>App</th>
                <th style={th}>Base</th>
                <th style={th}>Rate</th>
                <th style={th}>Commission</th>
                <th style={th}>Status</th>
                <th style={th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={String(c._id)}>
                  <td style={td}>{c.externalApp}</td>
                  <td style={td}>{formatBDT(c.basePriceMinor, "en")}</td>
                  <td style={td}>{(c.rateBp / 100).toFixed(2)}%</td>
                  <td style={{ ...td, color: "var(--color-text-strong)" }}>
                    {formatBDT(c.amountMinor, "en")}
                  </td>
                  <td style={td}>{c.status}</td>
                  <td style={td}>
                    {new Date(c.accruedAt).toLocaleDateString()}
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
