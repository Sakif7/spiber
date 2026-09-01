"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
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

/**
 * Mirrors `allowedOrderTransitions` in lib/schemas/order — COD and credit
 * orders ship BEFORE they are paid, so they may also go pending → processing.
 * Keep both in sync; the server is the authority and will reject anything else.
 */
function allowedFor(status: string, method: string): string[] {
  const base = TRANSITIONS[status] ?? [];
  const shipsBeforePayment = method === "cod" || method === "credit";
  return status === "pending" && shipsBeforePayment
    ? [...base, "processing"]
    : base;
}

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
  /** offline | cod | credit — legacy orders report "offline". */
  paymentMethod?: string;
  paymentStatus?: string;
};

export function OrderActions({
  orderId,
  status,
  paymentMethod = "offline",
  paymentStatus = "unpaid",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [txnId, setTxnId] = useState("");

  const allowed = allowedFor(status, paymentMethod);
  // COD/credit orders are paid outside the status machine (at the door, or on
  // terms after delivery), so payment is recorded as its own action.
  const canRecordPayment =
    (paymentMethod === "cod" || paymentMethod === "credit") &&
    paymentStatus === "unpaid" &&
    status !== "cancelled" &&
    status !== "refunded";

  async function recordPayment() {
    setBusy("record-payment");
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (txnId.trim()) body.txnId = txnId.trim();
      if (note.trim()) body.note = note.trim();
      const res = await fetch(`/api/admin/orders/${orderId}/record-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(
          json?.error?.message ??
            json?.error?.code ??
            "Could not record payment.",
        );
        return;
      }
      setTxnId("");
      setNote("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function transition(to: string) {
    setBusy(to);
    setError(null);
    try {
      const body: Record<string, unknown> = { to };
      if (note.trim()) body.note = note.trim();
      if (internalNote.trim()) body.internalNote = internalNote.trim();
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
      setInternalNote("");
      setTrackingNumber("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="admin-no-print bg-card flex flex-col gap-4 rounded-lg p-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-foreground font-[family-name:var(--font-display)] text-lg">
          Actions
        </h2>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {canRecordPayment ? (
        <div className="border-border flex flex-wrap items-end gap-3 rounded-md border p-3">
          <div className="min-w-[200px] flex-[1_1_220px] space-y-1.5">
            <Label htmlFor="order-txn">
              Reference (optional) —{" "}
              {paymentMethod === "cod" ? "cash on delivery" : "credit account"}
            </Label>
            <Input
              id="order-txn"
              value={txnId}
              onChange={(e) => setTxnId(e.target.value)}
              placeholder="e.g. receipt no. / bank ref"
            />
          </div>
          <Button
            variant="default"
            disabled={busy === "record-payment"}
            onClick={recordPayment}
          >
            {busy === "record-payment" ? "Working…" : "Record payment"}
          </Button>
          <p className="text-muted-foreground w-full text-xs">
            Marks the order paid without changing its status — these orders ship
            before the money arrives.
          </p>
        </div>
      ) : null}

      {allowed.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No further transitions available from <strong>{status}</strong>.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-[1_1_220px] space-y-1.5">
            <Label htmlFor="order-note">
              Note to customer (shown on their timeline)
            </Label>
            <Input
              id="order-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Handed to courier, arriving Sunday"
            />
          </div>
          <div className="min-w-[200px] flex-[1_1_220px] space-y-1.5">
            <Label htmlFor="order-internal-note">
              Internal note (admins only)
            </Label>
            <Input
              id="order-internal-note"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="Never shown to the customer"
            />
          </div>
          {allowed.includes("shipped") ? (
            <div className="min-w-[200px] flex-[1_1_220px] space-y-1.5">
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
        <div className="flex flex-wrap gap-3">
          {allowed.map((to) => (
            <Button
              key={to}
              variant={
                to === "cancelled" || to === "refunded"
                  ? "destructive"
                  : "default"
              }
              disabled={busy === to}
              onClick={() => transition(to)}
            >
              {busy === to ? "Working…" : (STATUS_LABEL[to] ?? to)}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
