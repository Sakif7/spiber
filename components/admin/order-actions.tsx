"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Mirrors lib/schemas/order ORDER_TRANSITIONS — kept local so this client comp pulls no server code. */
const TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "refunded", "cancelled"],
  processing: ["shipped", "refunded", "cancelled"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Mark paid",
  processing: "Start processing",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
  refunded: "Refund order",
};

type Props = {
  orderId: string;
  status: string;
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

const rowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--s-3)",
  alignItems: "flex-end",
};

export function OrderActions({ orderId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  const allowed = TRANSITIONS[status] ?? [];

  async function transition(to: string) {
    setBusy(to);
    setError(null);
    try {
      const body: Record<string, unknown> = { to };
      if (note.trim()) body.note = note.trim();
      if (to === "shipped" && trackingNumber.trim()) {
        body.trackingNumber = trackingNumber.trim();
      }
      const res = await fetch(`/api/admin/orders/${orderId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(
          json?.error?.message ?? json?.error?.code ?? "Transition failed.",
        );
        return;
      }
      setNote("");
      setTrackingNumber("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={cardStyle} className="admin-no-print">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
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
        <CtaButton variant="secondary" onClick={() => window.print()}>
          Print invoice
        </CtaButton>
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            color: "var(--color-error)",
            fontSize: "var(--fs-sm)",
          }}
        >
          {error}
        </p>
      ) : null}

      {allowed.length === 0 ? (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-sm)",
          }}
        >
          No further transitions available from <strong>{status}</strong>.
        </p>
      ) : (
        <div style={rowStyle}>
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <Label htmlFor="order-note">Note (optional)</Label>
            <Input
              id="order-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note for this change"
            />
          </div>
          {allowed.includes("shipped") ? (
            <div style={{ flex: "1 1 220px", minWidth: 200 }}>
              <Label htmlFor="order-tracking">
                Tracking number (for shipped)
              </Label>
              <Input
                id="order-tracking"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. SP123456789BD"
              />
            </div>
          ) : null}
        </div>
      )}

      {allowed.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)" }}>
          {allowed.map((to) => (
            <CtaButton
              key={to}
              variant={
                to === "cancelled" || to === "refunded"
                  ? "secondary"
                  : "primary"
              }
              onClick={() => transition(to)}
            >
              {busy === to ? "Working…" : (STATUS_LABEL[to] ?? to)}
            </CtaButton>
          ))}
        </div>
      ) : null}
    </section>
  );
}
