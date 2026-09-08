"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Mirrors CREDIT_APP_TRANSITIONS — local so this client comp pulls no server code. */
const TRANSITIONS: Record<string, string[]> = {
  new: ["reviewing", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: [],
  rejected: ["reviewing"],
};

const LABEL: Record<string, string> = {
  reviewing: "Start review",
  approved: "Approve & open account",
  rejected: "Reject",
};

/**
 * Review actions for a credit application. Approving provisions the buyer's
 * CreditAccount with the net terms entered here (default 30) — that is the
 * moment they become able to pay on terms at Medtrade checkout.
 */
export function CreditApplicationActions({
  applicationId,
  status,
  currentUserId,
  assignedToMe,
}: {
  applicationId: string;
  status: string;
  currentUserId: string;
  assignedToMe: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [termsDays, setTermsDays] = useState("30");

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
        `/api/admin/credit/applications/${applicationId}/${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error?.message ?? json?.error?.code ?? "Action failed.");
        return;
      }
      setNote("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-5">
      <h2 className="text-foreground font-[family-name:var(--font-display)] text-lg">
        Actions
      </h2>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="credit-note">Note (added to the activity log)</Label>
        <Textarea
          id="credit-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Trade licence verified against RJSC records"
        />
      </div>

      {allowed.includes("approved") ? (
        <div className="space-y-1.5">
          <Label htmlFor="credit-terms">Payment terms on approval (days)</Label>
          <Input
            id="credit-terms"
            type="number"
            min={1}
            max={365}
            value={termsDays}
            onChange={(e) => setTermsDays(e.target.value)}
            className="w-32"
          />
          <p className="text-muted-foreground text-xs">
            Invoices for this buyer will fall due this many days after the
            order.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {allowed.map((to) => (
          <Button
            key={to}
            variant={to === "rejected" ? "destructive" : "default"}
            disabled={busy === to}
            onClick={() =>
              call(
                "transition",
                {
                  to,
                  note: note.trim() || undefined,
                  ...(to === "approved"
                    ? { termsDays: Number(termsDays) || 30 }
                    : {}),
                },
                to,
              )
            }
          >
            {busy === to ? "Working…" : (LABEL[to] ?? to)}
          </Button>
        ))}
        <Button
          variant="outline"
          disabled={busy === "note" || !note.trim()}
          onClick={() => call("note", { body: note.trim() }, "note")}
        >
          {busy === "note" ? "Saving…" : "Add note only"}
        </Button>
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
          {assignedToMe ? "Unassign me" : "Assign to me"}
        </Button>
      </div>

      {allowed.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No further actions from <strong>{status}</strong>.
        </p>
      ) : null}
    </section>
  );
}
