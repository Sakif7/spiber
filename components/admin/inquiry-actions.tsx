"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";

/** Mirrors INQUIRY_TRANSITIONS — local so this client comp pulls no server code. */
const TRANSITIONS: Record<string, string[]> = {
  new: ["qualifying", "lost"],
  qualifying: ["proposal", "lost"],
  proposal: ["won", "lost"],
  won: [],
  lost: ["qualifying"],
};

const cardStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--s-4)",
};

const taStyle: CSSProperties = {
  font: "inherit",
  padding: "8px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
  resize: "vertical",
};

export function InquiryActions({
  inquiryId,
  status,
  currentUserId,
  assignedToMe,
}: {
  inquiryId: string;
  status: string;
  currentUserId: string;
  assignedToMe: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const allowed = TRANSITIONS[status] ?? [];

  async function call(
    path: string,
    body: Record<string, unknown>,
    tag: string,
  ) {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiryId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error?.code ?? "Action failed.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={cardStyle}>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-lg)",
          color: "var(--color-text-strong)",
        }}
      >
        Actions
      </h2>
      {error && (
        <p
          style={{
            margin: 0,
            color: "var(--color-error)",
            fontSize: "var(--fs-sm)",
          }}
        >
          {error}
        </p>
      )}

      {/* Assignment */}
      <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
        <CtaButton
          variant="secondary"
          onClick={() =>
            call(
              "assign",
              { assignedTo: assignedToMe ? null : currentUserId },
              "assign",
            )
          }
        >
          {busy === "assign"
            ? "Working…"
            : assignedToMe
              ? "Unassign me"
              : "Assign to me"}
        </CtaButton>
      </div>

      {/* Note */}
      <div style={{ display: "grid", gap: 6 }}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add an internal note"
          rows={3}
          style={taStyle}
        />
        <div>
          <CtaButton
            variant="secondary"
            onClick={async () => {
              if (!note.trim()) return;
              const ok = await call("note", { body: note.trim() }, "note");
              if (ok) setNote("");
            }}
          >
            {busy === "note" ? "Saving…" : "Add note"}
          </CtaButton>
        </div>
      </div>

      {/* Transitions */}
      {allowed.length === 0 ? (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-sm)",
          }}
        >
          No further transitions from <strong>{status}</strong>.
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)" }}>
          {allowed.map((to) => (
            <CtaButton
              key={to}
              variant={to === "won" ? "primary" : "secondary"}
              onClick={() =>
                call(
                  "transition",
                  note.trim() ? { to, note: note.trim() } : { to },
                  to,
                )
              }
            >
              {busy === to ? "Working…" : `Move to ${to}`}
            </CtaButton>
          ))}
        </div>
      )}
    </section>
  );
}
