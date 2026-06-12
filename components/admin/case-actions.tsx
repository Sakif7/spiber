"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Mirrors MEDICAL_CASE_TRANSITIONS — local so this client comp pulls no server code. */
const TRANSITIONS: Record<string, string[]> = {
  new: ["reviewing", "lost"],
  reviewing: ["quoted", "lost"],
  quoted: ["confirmed", "lost"],
  confirmed: ["arranging", "lost"],
  arranging: ["in_treatment", "lost"],
  in_treatment: ["follow_up"],
  follow_up: ["closed"],
  closed: [],
  lost: ["reviewing"],
};

export function CaseActions({
  caseId,
  status,
  currentUserId,
  assignedToMe,
}: {
  caseId: string;
  status: string;
  currentUserId: string;
  assignedToMe: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [quoteNote, setQuoteNote] = useState("");

  const allowed = TRANSITIONS[status] ?? [];

  async function call(
    path: string,
    body: Record<string, unknown>,
    tag: string,
  ) {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tourism/cases/${caseId}/${path}`, {
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

  async function sendQuote() {
    const amountMinor = amount
      ? Math.round(parseFloat(amount) * 100)
      : undefined;
    const ok = await call(
      "quote",
      {
        amountMinor,
        validUntil: validUntil || undefined,
        notes: quoteNote || undefined,
      },
      "quote",
    );
    if (ok) {
      setAmount("");
      setValidUntil("");
      setQuoteNote("");
    }
  }

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg p-5 shadow-[var(--shadow-sm)]">
      <h2 className="text-foreground m-0 font-[family-name:var(--font-display)] text-lg">
        Case actions
      </h2>
      {error && <p className="text-destructive m-0 text-sm">{error}</p>}

      {/* Assignment */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
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

      {/* Quotation panel (rendered on demand — no PDF stored) */}
      <div className="border-border grid gap-2 border-t pt-3">
        <strong className="text-foreground">Prepare quotation</strong>
        <Label className="text-muted-foreground text-xs">
          Estimated total (BDT)
        </Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 450000"
        />
        <Label className="text-muted-foreground text-xs">Valid until</Label>
        <Input
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
        />
        <Textarea
          value={quoteNote}
          onChange={(e) => setQuoteNote(e.target.value)}
          placeholder="What the quotation covers (shown to the patient)"
          rows={3}
        />
        <div>
          <Button onClick={sendQuote}>
            {busy === "quote" ? "Sending…" : "Send quotation"}
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
        <p className="text-muted-foreground m-0 text-sm">
          No further transitions from <strong>{status}</strong>.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {allowed.map((to) => (
            <Button
              key={to}
              variant={
                to === "closed" || to === "confirmed" ? "default" : "outline"
              }
              onClick={() =>
                call(
                  "transition",
                  note.trim() ? { to, note: note.trim() } : { to },
                  to,
                )
              }
            >
              {busy === to ? "Working…" : `Move to ${to.replace(/_/g, " ")}`}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
