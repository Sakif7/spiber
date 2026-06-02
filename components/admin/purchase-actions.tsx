"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
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

const cardStyle: CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--s-4)",
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
      {allowed.length === 0 && !canRetry ? (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-sm)",
          }}
        >
          No further actions from <strong>{status}</strong>.
        </p>
      ) : (
        <>
          {allowed.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              <Label htmlFor="purchase-note">Note (optional)</Label>
              <Input
                id="purchase-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Internal note"
              />
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)" }}>
            {allowed.map((to) => (
              <CtaButton
                key={to}
                variant={to === "paid" ? "primary" : "secondary"}
                onClick={() => transition(to)}
              >
                {busy === to ? "Working…" : (STATUS_LABEL[to] ?? to)}
              </CtaButton>
            ))}
            {canRetry && (
              <CtaButton variant="secondary" onClick={retry}>
                {busy === "retry" ? "Working…" : "Retry fulfillment"}
              </CtaButton>
            )}
          </div>
        </>
      )}
    </section>
  );
}
