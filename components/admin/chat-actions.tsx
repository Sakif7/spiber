"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

const STATUSES = ["open", "lead", "closed"] as const;

/** Triage a chat conversation: set status or soft-delete. */
export function ChatConversationActions({
  conversationId,
  status,
}: {
  conversationId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchStatus(next: string) {
    setBusy(next);
    setError(null);
    try {
      const res = await fetch(`/api/admin/chat/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error?.code ?? "Action failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this conversation? This can't be undone from here.")) {
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/admin/chat/${conversationId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error?.code ?? "Delete failed.");
        return;
      }
      router.push("/admin/chat");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg p-5 shadow-[var(--shadow-sm)]">
      <h2 className="text-foreground font-[family-name:var(--font-display)] text-lg">
        Actions
      </h2>
      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="grid gap-1.5">
        <span className="text-muted-foreground text-xs">Set status</span>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s}
              variant={s === status ? "default" : "outline"}
              size="sm"
              disabled={busy === s || s === status}
              onClick={() => patchStatus(s)}
            >
              {busy === s ? "Working…" : s}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy === "delete"}
          onClick={remove}
        >
          {busy === "delete" ? "Deleting…" : "Delete conversation"}
        </Button>
      </div>
    </section>
  );
}
