import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getChatConversationById } from "@/lib/repositories/chat.repo";
import { ChatConversationActions } from "@/components/admin/chat-actions";

export const dynamic = "force-dynamic";

export default async function AdminChatDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const c = await getChatConversationById(id).catch(() => null);
  if (!c) notFound();

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
          Conversation
        </h1>
        <span style={{ ...muted, fontFamily: "var(--font-mono)" }}>
          {c.ref} · {c.status} · {c.locale ?? "en"} ·{" "}
          {new Date(c.updatedAt).toLocaleString()}
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
          {/* Transcript */}
          <section style={{ ...card, gap: "var(--s-2)" }}>
            <strong style={{ color: "var(--color-text-strong)" }}>
              Transcript ({c.messages?.length ?? 0})
            </strong>
            {(c.messages ?? []).length === 0 && (
              <span style={muted}>No messages recorded.</span>
            )}
            {(c.messages ?? []).map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  alignItems: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "88%",
                    padding: "8px 12px",
                    borderRadius: 12,
                    fontSize: 14,
                    whiteSpace: "pre-wrap",
                    background:
                      m.role === "user"
                        ? "var(--color-brand)"
                        : "var(--color-surface-2)",
                    color: m.role === "user" ? "#fff" : "var(--color-text)",
                  }}
                >
                  {m.text}
                </div>
                <span style={{ ...muted, fontSize: 11 }}>
                  {m.role === "user" ? "Visitor" : "Bot"}
                  {m.intent ? ` · ${m.intent}` : ""}
                  {m.at ? ` · ${new Date(m.at).toLocaleTimeString()}` : ""}
                </span>
              </div>
            ))}
          </section>
        </div>

        <div style={{ display: "grid", gap: "var(--s-5)" }}>
          {c.lead && (
            <section style={card}>
              <strong style={{ color: "var(--color-text-strong)" }}>
                Captured lead
              </strong>
              <Row label="Name" value={c.lead.name} />
              <Row label="Email" value={c.lead.email} />
              {c.lead.phone && <Row label="Phone" value={c.lead.phone} />}
              {c.lead.message && (
                <p
                  style={{
                    margin: 0,
                    whiteSpace: "pre-line",
                    color: "var(--color-text)",
                  }}
                >
                  {c.lead.message}
                </p>
              )}
              <Row label="Reference" value={c.lead.leadNumber} mono />
            </section>
          )}

          <ChatConversationActions
            conversationId={String(c._id)}
            status={c.status}
          />
        </div>
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
