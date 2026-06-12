"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Mirrors PURCHASE_TRANSITIONS — local so this client comp pulls no server code. */
const TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "cancelled"],
  paid: ["refunded"],
  cancelled: [],
  refunded: [],
};
const STATUS_LABEL: Record<string, string> = {
  paid: "Mark paid (run fulfillment)",
  cancelled: "Cancel",
  refunded: "Refund",
};

export function PurchaseActions({
  purchaseId,
  status,
  fulfillmentStatus,
}: {
  purchaseId: string;
  status: string;
  fulfillmentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const allowed = TRANSITIONS[status] ?? [];
  const canRetry = status === "paid" && fulfillmentStatus === "failed";

  async function transition(to: string) {
    setBusy(to);
    setError(null);
    try {
      const body: Record<string, unknown> = { to };
      if (note.trim()) body.note = note.trim();
      const res = await fetch(
        `/api/admin/software-purchases/${purchaseId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error?.code ?? "Transition failed.");
        return;
      }
      setNote("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function retry() {
    setBusy("retry");
    setError(null);
    const res = await fetch(
      `/api/admin/software-purchases/${purchaseId}/retry-fulfillment`,
      { method: "POST" },
    );
    setBusy(null);
    if (res.ok) router.refresh();
    else setError("Fulfillment retry failed.");
  }

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg p-5 shadow-[var(--shadow-sm)]">
      <h2 className="text-foreground font-[family-name:var(--font-display)] text-lg">
        Actions
      </h2>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {allowed.length === 0 && !canRetry ? (
        <p className="text-muted-foreground text-sm">
          No further actions from <strong>{status}</strong>.
        </p>
      ) : (
        <>
          {allowed.length > 0 && (
            <div className="grid gap-1.5">
              <Label htmlFor="purchase-note">Note (optional)</Label>
              <Input
                id="purchase-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Internal note"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {allowed.map((to) => (
              <Button
                key={to}
                variant={
                  to === "paid"
                    ? "default"
                    : to === "refunded" || to === "cancelled"
                      ? "destructive"
                      : "outline"
                }
                disabled={busy === to}
                onClick={() => transition(to)}
              >
                {busy === to ? "Working…" : (STATUS_LABEL[to] ?? to)}
              </Button>
            ))}
            {canRetry && (
              <Button
                variant="outline"
                disabled={busy === "retry"}
                onClick={retry}
              >
                {busy === "retry" ? "Working…" : "Retry fulfillment"}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
