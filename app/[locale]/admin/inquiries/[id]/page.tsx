import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { InquiryActions } from "@/components/admin/inquiry-actions";
import { getInquiryByIdLean } from "@/lib/repositories/inquiries.repo";
import { getSessionUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const q = await getInquiryByIdLean(id).catch(() => null);
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
          {q.subject || q.inquiryNumber}
        </h1>
        <span style={{ ...muted, fontFamily: "var(--font-mono)" }}>
          {q.inquiryNumber} · {q.division} · {q.status}
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
            <Row label="Name" value={q.name} />
            <Row label="Email" value={q.email} />
            {q.phone && <Row label="Phone" value={q.phone} />}
            {q.company && <Row label="Company" value={q.company} />}
            {q.budgetRange && <Row label="Budget" value={q.budgetRange} />}
            {q.linkedEntity && (
              <Row
                label="Linked"
                value={`${q.linkedEntity.kind}: ${q.linkedEntity.id}`}
                mono
              />
            )}
          </section>

          <section style={card}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              Message
            </strong>
            <p
              style={{
                margin: 0,
                whiteSpace: "pre-line",
                color: "var(--color-text)",
              }}
            >
              {q.message}
            </p>
          </section>

          {q.notes.length > 0 && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Notes
              </strong>
              {q.notes.map((n, i) => (
                <div key={i} style={{ display: "grid", gap: 2 }}>
                  <span style={{ color: "var(--color-text)" }}>{n.body}</span>
                  <span style={muted}>{new Date(n.at).toLocaleString()}</span>
                </div>
              ))}
            </section>
          )}
        </div>

        <InquiryActions
          inquiryId={String(q._id)}
          status={q.status}
          currentUserId={user?.sub ?? ""}
          assignedToMe={assignedToMe}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
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
          fontFamily: mono ? "var(--font-mono)" : "inherit",
          wordBreak: "break-all",
          textAlign: "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
