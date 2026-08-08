import { setRequestLocale } from "next-intl/server";
import type { CSSProperties } from "react";
import { redirect } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth/guard";
import {
  listSellerCommissions,
  sellerEarningsSummary,
} from "@/lib/repositories/seller-commissions.repo";
import { listSellerPayouts } from "@/lib/repositories/seller-payouts.repo";
import { getSellerCommissionBp } from "@/lib/services/seller-settings.service";
import { formatBDT } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

function pct(bp: number): string {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
}

export const dynamic = "force-dynamic";

export default async function SellerPayoutsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const session = await requireSeller();
  if (!session) {
    redirect({ href: "/become-a-seller", locale: locale as never });
  }

  const sellerId = String(session!.seller._id);

  const [summary, commissions, payouts, globalBp] = await Promise.all([
    sellerEarningsSummary(sellerId),
    listSellerCommissions({ sellerId }),
    listSellerPayouts({ sellerId }),
    getSellerCommissionBp().catch(() => 1000),
  ]);

  const overrideBp = session!.seller.commissionBp;
  const hasOverride = typeof overrideBp === "number";

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h1 style={pageTitle}>Payouts</h1>
        <p style={subtle}>Your earnings, commissions and payout history.</p>
      </div>

      <div style={kpiGrid}>
        <div style={kpiCard}>
          <span style={kpiLabel}>Available</span>
          <strong style={kpiValue}>
            {formatBDT(summary.accruedMinor, loc)}
          </strong>
        </div>
        <div style={kpiCard}>
          <span style={kpiLabel}>Paid out</span>
          <strong style={kpiValue}>{formatBDT(summary.paidMinor, loc)}</strong>
        </div>
        <div style={kpiCard}>
          <span style={kpiLabel}>Your commission rate</span>
          <strong style={kpiValue}>
            {pct(hasOverride ? (overrideBp as number) : globalBp)}
          </strong>
          <span style={subtle}>
            {hasOverride
              ? "Negotiated rate — applies to all your sales."
              : "Platform default. Some categories carry their own rate; each order's exact fee is shown below."}
          </span>
        </div>
      </div>

      <section style={{ display: "grid", gap: "var(--s-4)" }}>
        <h2 style={panelTitle}>Commissions</h2>
        {commissions.length === 0 ? (
          <p style={subtle}>No commissions yet.</p>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Order</th>
                  <th style={{ ...th, textAlign: "right" }}>Sales</th>
                  <th style={{ ...th, textAlign: "right" }}>Rate</th>
                  <th style={{ ...th, textAlign: "right" }}>Commission</th>
                  <th style={{ ...th, textAlign: "right" }}>Earnings</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={String(c._id)} style={tr}>
                    <td style={{ ...td, fontFamily: "var(--font-mono)" }}>
                      {c.orderNumber}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {formatBDT(c.itemSubtotalMinor, loc)}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {pct(c.commissionRateBp)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {formatBDT(c.commissionAmountMinor, loc)}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        color: "var(--color-text-strong)",
                        fontWeight: 500,
                      }}
                    >
                      {formatBDT(c.sellerEarningsMinor, loc)}
                    </td>
                    <td style={td}>
                      <span style={statusPill}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ display: "grid", gap: "var(--s-4)" }}>
        <h2 style={panelTitle}>Payout history</h2>
        {payouts.length === 0 ? (
          <p style={subtle}>No payouts yet.</p>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Payout</th>
                  <th style={{ ...th, textAlign: "right" }}>Amount</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: "right" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={String(p._id)} style={tr}>
                    <td style={{ ...td, fontFamily: "var(--font-mono)" }}>
                      {p.payoutNumber}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        color: "var(--color-text-strong)",
                        fontWeight: 500,
                      }}
                    >
                      {formatBDT(p.totalEarningsMinor, loc)}
                    </td>
                    <td style={td}>
                      <span style={statusPill}>{p.status}</span>
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const pageTitle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-h3)",
  color: "var(--color-text-strong)",
};

const subtle: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-small)",
};

const panelTitle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-h5)",
  color: "var(--color-text-strong)",
};

const kpiGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "var(--s-4)",
};

const kpiCard: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  padding: "var(--s-5)",
  display: "grid",
  gap: 8,
};

const kpiLabel: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-caption)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const kpiValue: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-h4)",
  color: "var(--color-text-strong)",
};

const tableWrap: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  overflowX: "auto",
};

const table: CSSProperties = {
  width: "100%",
  minWidth: 640,
  borderCollapse: "collapse",
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: "var(--fs-caption)",
  fontWeight: 600,
  color: "var(--color-text-muted)",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};

const tr: CSSProperties = {
  borderBottom: "1px solid var(--color-border)",
};

const td: CSSProperties = {
  padding: "12px 16px",
  fontSize: 14,
  color: "var(--color-text)",
  verticalAlign: "middle",
};

const statusPill: CSSProperties = {
  fontSize: "var(--fs-caption)",
  padding: "3px 10px",
  borderRadius: "var(--r-pill)",
  background: "var(--color-surface-2)",
  color: "var(--color-text-muted)",
  textTransform: "capitalize",
};
