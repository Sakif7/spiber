"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Mirrors INQUIRY_TRANSITIONS — local so this client comp pulls no server code. */
const TRANSITIONS: Record<string, string[]> = {
  new: ["qualifying", "lost"],
  qualifying: ["proposal", "lost"],
  proposal: ["won", "lost"],
  won: [],
  lost: ["qualifying"],
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

      {/* Note */}
      <div className="grid gap-1.5">
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
