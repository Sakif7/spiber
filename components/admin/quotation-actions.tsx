"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";

/** Mirrors QUOTATION_TRANSITIONS — local so this client comp pulls no server code. */
const TRANSITIONS: Record<string, string[]> = {
  new: ["quoted", "lost"],
  quoted: ["negotiating", "won", "lost"],
  negotiating: ["won", "lost"],
  won: [],
  lost: ["negotiating"],
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

const inputStyle: CSSProperties = {
  font: "inherit",
  padding: "8px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-sm)",
  background: "var(--color-surface)",
  width: "100%",
};

export function QuotationActions({
  quotationId,
  status,
  currentUserId,
  assignedToMe,
}: {
  quotationId: string;
  status: string;
  currentUserId: string;
  assignedToMe: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  // Quote panel
  const [amount, setAmount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const allowed = TRANSITIONS[status] ?? [];

  async function call(
    path: string,
    body: Record<string, unknown>,
    tag: string,
  ) {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quotations/${quotationId}/${path}`, {
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

  async function uploadPdf(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setFileKey(json.data.url);
      else setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function sendQuote() {
    const amountMinor = amount
      ? Math.round(parseFloat(amount) * 100)
      : undefined;
    const ok = await call(
      "quote",
      {
        amountMinor,
        validUntil: validUntil || undefined,
        fileKey: fileKey || undefined,
        note: quoteNote || undefined,
      },
      "quote",
    );
    if (ok) {
      setAmount("");
      setValidUntil("");
      setQuoteNote("");
      setFileKey(null);
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

      {/* Quote panel */}
      <div
        style={{
          display: "grid",
          gap: 8,
          paddingTop: "var(--s-3)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <strong style={{ color: "var(--color-text-strong)" }}>
          Prepare quote
        </strong>
        <label style={lbl}>Quoted total (BDT)</label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 125000"
          style={inputStyle}
        />
        <label style={lbl}>Valid until</label>
        <input
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          style={inputStyle}
        />
        <label style={lbl}>Quote PDF (optional)</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadPdf(f);
          }}
          style={{ ...inputStyle, padding: 6 }}
        />
        {uploading && (
          <span style={{ fontSize: "var(--fs-caption)" }}>Uploading…</span>
        )}
        {fileKey && (
          <span
            style={{
              fontSize: "var(--fs-caption)",
              color: "var(--color-success)",
            }}
          >
            ✓ PDF attached
          </span>
        )}
        <textarea
          value={quoteNote}
          onChange={(e) => setQuoteNote(e.target.value)}
          placeholder="Note to the requester (optional)"
          rows={2}
          style={inputStyle}
        />
        <div>
          <CtaButton onClick={sendQuote}>
            {busy === "quote" ? "Sending…" : "Send quote"}
          </CtaButton>
        </div>
      </div>

      {/* Internal note */}
      <div
        style={{
          display: "grid",
          gap: 6,
          paddingTop: "var(--s-3)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add an internal note"
          rows={3}
          style={inputStyle}
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

const lbl: CSSProperties = {
  fontSize: "var(--fs-caption)",
  color: "var(--color-text-muted)",
};
