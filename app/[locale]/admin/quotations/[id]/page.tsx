import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { QuotationActions } from "@/components/admin/quotation-actions";
import { getQuotationByIdLean } from "@/lib/repositories/quotations.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { asLocale } from "@/lib/i18n/intl-locale";
import { formatBDT } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminQuotationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const q = await getQuotationByIdLean(id).catch(() => null);
  if (!q) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && q.assignedTo && String(q.assignedTo) === user.sub,
  );

  const card: React.CSSProperties = {
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    borderRadius: "var(--r-lg)",
    padding: "var(--s-5)",
    display: "grid",
    gap: "var(--s-3)",
  };
  const muted: React.CSSProperties = {
    color: "var(--color-text-muted)",
    fontSize: "var(--fs-body-sm)",
  };

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
          }}
        >
          {q.quotationNumber}
        </h1>
        <span style={{ ...muted, fontFamily: "var(--font-mono)" }}>
          {q.status} · {q.items.length} item{q.items.length === 1 ? "" : "s"} ·{" "}
          {new Date(q.createdAt).toLocaleString()}
        </span>
      </div>

      <div
        className="equal-2col"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: "var(--s-5)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "var(--s-5)" }}>
          <section style={card}>
            <Row label="Name" value={q.contact.name} />
            <Row label="Email" value={q.contact.email} />
            {q.contact.phone && <Row label="Phone" value={q.contact.phone} />}
            {q.contact.organization && (
              <Row label="Organization" value={q.contact.organization} />
            )}
            <Row
              label="Deliver to"
              value={
                q.deliveryLocation.city
                  ? `${q.deliveryLocation.city}, ${q.deliveryLocation.district}`
                  : q.deliveryLocation.district
              }
            />
            {q.timeline && <Row label="Timeline" value={q.timeline} />}
          </section>

          <section style={card}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              Line items
            </strong>
            {q.items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "var(--s-3)",
                  borderTop: i === 0 ? "none" : "1px solid var(--color-border)",
                  paddingTop: i === 0 ? 0 : 8,
                }}
              >
                <span>
                  {localize(it.productSnapshot.name, asLocale(locale))}
                  {it.productSnapshot.variantOptions &&
                  it.productSnapshot.variantOptions.length > 0
                    ? ` (${it.productSnapshot.variantOptions.map((o) => o.value).join(" · ")})`
                    : ""}
                  <span
                    style={{
                      ...muted,
                      fontFamily: "var(--font-mono)",
                      marginLeft: 8,
                    }}
                  >
                    {it.productSnapshot.sku}
                  </span>
                </span>
                <strong>× {it.quantity}</strong>
              </div>
            ))}
          </section>

          {q.notes && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Customer note
              </strong>
              <p
                style={{
                  margin: 0,
                  whiteSpace: "pre-line",
                  color: "var(--color-text)",
                }}
              >
                {q.notes}
              </p>
            </section>
          )}

          {q.quote?.amountMinor != null && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Current quote
              </strong>
              <Row label="Amount" value={formatBDT(q.quote.amountMinor)} />
              {q.quote.validUntil && (
                <Row
                  label="Valid until"
                  value={new Date(q.quote.validUntil).toLocaleDateString()}
                />
              )}
              {q.quote.note && <p style={{ margin: 0 }}>{q.quote.note}</p>}
              {q.quote.fileKey && (
                <a
                  href={`/api/media/quotation/${String(q._id)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--color-brand-deep)" }}
                >
                  View attached PDF
                </a>
              )}
            </section>
          )}

          {q.activity.length > 0 && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Activity
              </strong>
              {q.activity.map((n, i) => (
                <div key={i} style={{ display: "grid", gap: 2 }}>
                  <span style={{ color: "var(--color-text)" }}>{n.body}</span>
                  <span style={muted}>{new Date(n.at).toLocaleString()}</span>
                </div>
              ))}
            </section>
          )}
        </div>

        <QuotationActions
          quotationId={String(q._id)}
          status={q.status}
          currentUserId={user?.sub ?? ""}
          assignedToMe={assignedToMe}
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--s-4)",
      }}
    >
      <span
        style={{
          color: "var(--color-text-muted)",
          fontSize: "var(--fs-body-sm)",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          color: "var(--color-text-strong)",
          wordBreak: "break-all",
          textAlign: "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
