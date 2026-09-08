"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TRANSITIONS: Record<string, string[]> = {
  new: ["quoted", "cancelled"],
  quoted: ["confirmed", "cancelled"],
  confirmed: ["closed"],
  closed: [],
  cancelled: [],
};

export function TravelActions({
  travelRequestId,
  status,
  currentUserId,
  assignedToMe,
}: {
  travelRequestId: string;
  status: string;
  currentUserId: string;
  assignedToMe: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
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
      const res = await fetch(
        `/api/admin/tourism/travel/${travelRequestId}/${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
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
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-5">
      <h2 className="text-foreground m-0 font-[family-name:var(--font-display)] text-lg">
        Actions
      </h2>
      {error && <p className="text-destructive m-0 text-sm">{error}</p>}

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

      {/* Quote */}
      <div className="border-border grid gap-2 border-t pt-3">
        <strong className="text-foreground">Send quote</strong>
        <Label className="text-muted-foreground text-xs">
          Quoted total (BDT)
        </Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 65000"
        />
        <Textarea
          value={quoteNote}
          onChange={(e) => setQuoteNote(e.target.value)}
          placeholder="Note to the requester (optional)"
          rows={2}
        />
        <div>
          <Button
            onClick={async () => {
              const amountMinor = amount
                ? Math.round(parseFloat(amount) * 100)
                : undefined;
              const ok = await call(
                "quote",
                { amountMinor, note: quoteNote || undefined },
                "quote",
              );
              if (ok) {
                setAmount("");
                setQuoteNote("");
              }
            }}
          >
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
                to === "confirmed" || to === "closed" ? "default" : "outline"
              }
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
