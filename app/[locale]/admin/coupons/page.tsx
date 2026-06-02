import { setRequestLocale } from "next-intl/server";
import { listCoupons } from "@/lib/repositories/coupons.repo";
import { formatBDT } from "@/lib/money";
import { CouponForm } from "@/components/admin/coupon-form";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string }> };

type CouponRow = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotalMinor: number | null;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
};

async function loadCoupons(): Promise<CouponRow[]> {
  try {
    const coupons = await listCoupons();
    return coupons.map((c) => ({
      id: String(c._id),
      code: c.code,
      type: c.type,
      value: c.value,
      minSubtotalMinor:
        typeof c.minSubtotalMinor === "number" ? c.minSubtotalMinor : null,
      usageLimit: typeof c.usageLimit === "number" ? c.usageLimit : null,
      usedCount: c.usedCount ?? 0,
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
      active: Boolean(c.active),
    }));
  } catch {
    return [];
  }
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--s-2) var(--s-3)",
  fontSize: "var(--fs-sm)",
  fontWeight: 600,
  color: "var(--color-text-muted)",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "var(--s-2) var(--s-3)",
  fontSize: "var(--fs-sm)",
  color: "var(--color-text)",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "middle",
};

function valueLabel(c: CouponRow): string {
  return c.type === "percent" ? `${c.value}%` : formatBDT(c.value);
}

function badge(active: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "var(--r-sm)",
    fontSize: "var(--fs-xs)",
    fontWeight: 600,
    color: active ? "var(--color-success)" : "var(--color-text-muted)",
    border: `1px solid ${active ? "var(--color-success)" : "var(--color-border)"}`,
  };
}

export default async function CouponsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const coupons = await loadCoupons();

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <header style={{ display: "grid", gap: "var(--s-2)" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          Coupons
        </h1>
        <p
          style={{
            fontSize: "var(--fs-sm)",
            color: "var(--color-text-muted)",
            margin: 0,
          }}
        >
          Manage discount codes applied at checkout.
        </p>
      </header>

      <section
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        {coupons.length === 0 ? (
          <div
            style={{
              padding: "var(--s-8)",
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "var(--fs-sm)",
            }}
          >
            No coupons yet. Create one below.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-mono)",
              }}
            >
              <thead>
                <tr>
                  <th style={th}>Code</th>
                  <th style={th}>Type</th>
                  <th style={th}>Value</th>
                  <th style={th}>Min subtotal</th>
                  <th style={th}>Used / Limit</th>
                  <th style={th}>Expires</th>
                  <th style={th}>Active</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td
                      style={{
                        ...td,
                        fontWeight: 600,
                        color: "var(--color-text-strong)",
                      }}
                    >
                      {c.code}
                    </td>
                    <td style={td}>{c.type}</td>
                    <td style={td}>{valueLabel(c)}</td>
                    <td style={td}>
                      {c.minSubtotalMinor === null
                        ? "—"
                        : formatBDT(c.minSubtotalMinor)}
                    </td>
                    <td style={td}>
                      {c.usedCount} /{" "}
                      {c.usageLimit === null ? "∞" : c.usageLimit}
                    </td>
                    <td style={td}>
                      {c.expiresAt
                        ? new Date(c.expiresAt).toLocaleDateString("en-US")
                        : "—"}
                    </td>
                    <td style={td}>
                      <span style={badge(c.active)}>
                        {c.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-6)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-lg)",
            color: "var(--color-text-strong)",
            margin: "0 0 var(--s-4)",
          }}
        >
          New coupon
        </h2>
        <CouponForm />
      </section>
    </div>
  );
}
