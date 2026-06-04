import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  listQuotations,
  type QuotationListParams,
} from "@/lib/repositories/quotations.repo";
import { formatBDT } from "@/lib/money";
import type { QuotationStatus } from "@/lib/schemas/quotation";

export const dynamic = "force-dynamic";

const STATUSES: (QuotationStatus | "all")[] = [
  "all",
  "new",
  "quoted",
  "negotiating",
  "won",
  "lost",
];

export default async function AdminQuotationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);

  const filter: QuotationListParams = { pageSize: 100 };
  if (status && status !== "all") filter.status = status as QuotationStatus;

  let rows: Awaited<ReturnType<typeof listQuotations>>["items"] = [];
  try {
    rows = (await listQuotations(filter)).items;
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--s-4)",
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
          Quotations
        </h1>
        <a
          href={`/api/admin/quotations/export`}
          style={{
            color: "var(--color-brand-deep)",
            fontSize: "var(--fs-body-sm)",
            fontWeight: 600,
          }}
        >
          Export CSV
        </a>
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STATUSES.map((s) => {
          const active = (status ?? "all") === s;
          return (
            <Link
              key={s}
              href={
                s === "all"
                  ? "/admin/quotations"
                  : `/admin/quotations?status=${s}`
              }
              style={{
                padding: "6px 14px",
                borderRadius: "var(--r-pill)",
                border: "1px solid var(--color-border)",
                background: active
                  ? "var(--color-brand)"
                  : "var(--color-surface)",
                color: active ? "#fff" : "var(--color-text)",
                fontSize: "var(--fs-caption)",
                textTransform: "capitalize",
                fontWeight: 600,
              }}
            >
              {s}
            </Link>
          );
        })}
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
            No quotation requests yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Reference</th>
                <th style={th}>Requester</th>
                <th style={th}>Organization</th>
                <th style={th}>Items</th>
                <th style={th}>Status</th>
                <th style={th}>Quoted</th>
                <th style={th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={String(q._id)}>
                  <td style={{ ...td, fontFamily: "var(--font-mono)" }}>
                    <Link
                      href={`/admin/quotations/${String(q._id)}`}
                      style={{ color: "var(--color-brand-deep)" }}
                    >
                      {q.quotationNumber}
                    </Link>
                  </td>
                  <td style={td}>{q.contact.name}</td>
                  <td style={td}>{q.contact.organization ?? "—"}</td>
                  <td style={td}>{q.items.length}</td>
                  <td style={{ ...td, textTransform: "capitalize" }}>
                    {q.status}
                  </td>
                  <td style={td}>
                    {q.quote?.amountMinor != null
                      ? formatBDT(q.quote.amountMinor)
                      : "—"}
                  </td>
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
