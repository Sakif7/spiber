import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { TravelActions } from "@/components/admin/travel-actions";
import { getTravelRequestByIdLean } from "@/lib/repositories/travelRequests.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { formatBDT } from "@/lib/money";

export const dynamic = "force-dynamic";

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

export default async function AdminTravelDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const r = await getTravelRequestByIdLean(id).catch(() => null);
  if (!r) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && r.assignedTo && String(r.assignedTo) === user.sub,
  );

  const details = Object.entries(r.details ?? {});

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
          {r.travelRequestNumber}
        </h1>
        <span style={{ ...muted, fontFamily: "var(--font-mono)" }}>
          {r.type} · {r.status} · {new Date(r.createdAt).toLocaleString()}
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
            <Row label="Contact" value={r.contact.name} />
            <Row label="Email" value={r.contact.email} />
            <Row label="Phone" value={r.contact.phone} />
            <Row label="Provider" value={r.provider} />
          </section>

          <section style={card}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              Request details
            </strong>
            {details.length === 0 ? (
              <span style={muted}>No details provided.</span>
            ) : (
              details.map(([k, v]) => (
                <Row key={k} label={k} value={String(v)} />
              ))
            )}
          </section>

          {r.quote?.amountMinor != null && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Quote
              </strong>
              <Row label="Amount" value={formatBDT(r.quote.amountMinor)} />
              {r.quote.note && <p style={{ margin: 0 }}>{r.quote.note}</p>}
            </section>
          )}

          {r.activity.length > 0 && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Activity
              </strong>
              {r.activity.map((n, i) => (
                <div key={i} style={{ display: "grid", gap: 2 }}>
                  <span style={{ color: "var(--color-text)" }}>{n.body}</span>
                  <span style={muted}>{new Date(n.at).toLocaleString()}</span>
                </div>
              ))}
            </section>
          )}
        </div>

        <TravelActions
          travelRequestId={String(r._id)}
          status={r.status}
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
          textTransform: "capitalize",
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
