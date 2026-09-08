"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Mirrors QUOTATION_TRANSITIONS — local so this client comp pulls no server code. */
const TRANSITIONS: Record<string, string[]> = {
  new: ["quoted", "lost"],
  quoted: ["negotiating", "won", "lost"],
  negotiating: ["won", "lost"],
  won: [],
  lost: ["negotiating"],
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
      // Business quotes are private: store under the private root and serve
      // only through the owner/admin-gated /api/media/quotation route.
      fd.append("visibility", "private");
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setFileKey(json.data.key || json.data.url);
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
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-5">
      <h2 className="text-foreground font-[family-name:var(--font-display)] text-lg">
        Actions
      </h2>
      {error && <p className="text-destructive text-sm">{error}</p>}

      {/* Assignment */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={busy === "assign"}
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
        </Button>
      </div>

      {/* Quote panel */}
      <div className="border-border grid gap-2 border-t pt-3">
        <strong className="text-foreground">Prepare quote</strong>
        <Label className="text-muted-foreground text-xs">
          Quoted total (BDT)
        </Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 125000"
        />
        <Label className="text-muted-foreground text-xs">Valid until</Label>
        <Input
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
        />
        <Label className="text-muted-foreground text-xs">
          Quote PDF (optional)
        </Label>
        <Input
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadPdf(f);
          }}
          className="py-1.5"
        />
        {uploading && (
          <span className="text-muted-foreground text-xs">Uploading…</span>
        )}
        {fileKey && (
          <span className="text-admin-xs text-[var(--tone-success-fg)]">
            ✓ PDF attached
          </span>
        )}
        <Textarea
          value={quoteNote}
          onChange={(e) => setQuoteNote(e.target.value)}
          placeholder="Note to the requester (optional)"
          rows={2}
        />
        <div>
          <Button disabled={busy === "quote"} onClick={sendQuote}>
            {busy === "quote" ? "Sending…" : "Send quote"}
          </Button>
        </div>
      </div>

      {/* Internal note */}
      <div className="border-border grid gap-1.5 border-t pt-3">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add an internal note"
          rows={3}
        />
        <div>
          <Button
            variant="outline"
            disabled={busy === "note"}
            onClick={async () => {
              if (!note.trim()) return;
              const ok = await call("note", { body: note.trim() }, "note");
              if (ok) setNote("");
            }}
          >
            {busy === "note" ? "Saving…" : "Add note"}
          </Button>
        </div>
      </div>

      {/* Transitions */}
      {allowed.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No further transitions from <strong>{status}</strong>.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {allowed.map((to) => (
            <Button
              key={to}
              variant={to === "won" ? "default" : "outline"}
              disabled={busy === to}
              onClick={() =>
                call(
                  "transition",
                  note.trim() ? { to, note: note.trim() } : { to },
                  to,
                )
              }
            >
              {busy === to ? "Working…" : `Move to ${to}`}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
