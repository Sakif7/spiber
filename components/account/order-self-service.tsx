"use client";

import { useState } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import type { SelfService } from "@/lib/services/order.service";

/**
 * Customer-side order actions: cancel (pending orders) or request a refund
 * (paid → delivered-within-window). Eligibility is computed server-side and
 * re-enforced by the API; this widget only renders the allowed action.
 */
export function OrderSelfService({
  orderNumber,
  selfService,
}: {
  orderNumber: string;
  selfService: SelfService;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "confirm-cancel" | "refund-form">(
    "idle",
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"cancelled" | "requested" | null>(null);

  async function doCancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/account/orders/${encodeURIComponent(orderNumber)}/cancel`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(
          json?.error?.code === "not_allowed"
            ? "This order can no longer be cancelled online — please contact support."
            : "Could not cancel the order. Please try again.",
        );
        setBusy(false);
        return;
      }
      setDone("cancelled");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  async function doRefundRequest(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError("Please describe the reason (at least a few words).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/account/orders/${encodeURIComponent(orderNumber)}/refund-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(
          json?.error?.code === "not_allowed"
            ? "This order isn't eligible for an online refund request — please contact support."
            : "Could not submit the request. Please try again.",
        );
        setBusy(false);
        return;
      }
      setDone("requested");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  const policyLink = (
    <Link
      href="/kart/returns"
      style={{ color: "var(--color-brand-deep)", fontWeight: 600 }}
    >
      returns &amp; refund policy
    </Link>
  );

  if (done === "cancelled") {
    return (
      <p style={{ margin: 0, color: "var(--color-success)" }}>
        Your order has been cancelled. A confirmation email is on its way.
      </p>
    );
  }
  if (done === "requested" || selfService.refundRequestedAt) {
    return (
      <p style={{ margin: 0, color: "var(--color-text)" }}>
        <strong style={{ color: "var(--color-brand-deep)" }}>
          Refund requested.
        </strong>{" "}
        Our team is reviewing it — you&apos;ll receive an email once it&apos;s
        settled. See our {policyLink}.
      </p>
    );
  }

  if (selfService.canCancel) {
    return (
      <div style={{ display: "grid", gap: "var(--s-3)" }}>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          This order hasn&apos;t been paid or processed yet — you can still
          cancel it. See our {policyLink}.
        </p>
        {mode === "confirm-cancel" ? (
          <div
            style={{
              display: "flex",
              gap: "var(--s-3)",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{ color: "var(--color-text-strong)", fontWeight: 600 }}
            >
              Cancel this order?
            </span>
            <CtaButton onClick={doCancel} variant="secondary">
              {busy ? "Cancelling…" : "Yes, cancel it"}
            </CtaButton>
            <button
              type="button"
              onClick={() => setMode("idle")}
              style={{
                background: "none",
                border: "none",
                font: "inherit",
                cursor: "pointer",
                color: "var(--color-text-muted)",
              }}
            >
              Keep the order
            </button>
          </div>
        ) : (
          <div>
            <CtaButton
              onClick={() => setMode("confirm-cancel")}
              variant="secondary"
            >
              Cancel order
            </CtaButton>
          </div>
        )}
        {error && (
          <p
            style={{
              margin: 0,
              color: "var(--color-error)",
              fontSize: "var(--fs-small)",
            }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  if (selfService.canRequestRefund) {
    return (
      <div style={{ display: "grid", gap: "var(--s-3)" }}>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          Something wrong with this order? You can request a refund — our team
          reviews every request per the {policyLink}.
        </p>
        {mode === "refund-form" ? (
          <form
            onSubmit={doRefundRequest}
            style={{ display: "grid", gap: "var(--s-3)" }}
          >
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Tell us what went wrong (damaged item, wrong product, …)"
              style={{
                font: "inherit",
                padding: "10px 12px",
                border: "1px solid var(--color-border-field)",
                borderRadius: "var(--r-sm)",
                background: "var(--color-surface)",
                width: "100%",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: "var(--s-3)" }}>
              <CtaButton type="submit" variant="secondary">
                {busy ? "Submitting…" : "Submit refund request"}
              </CtaButton>
              <button
                type="button"
                onClick={() => setMode("idle")}
                style={{
                  background: "none",
                  border: "none",
                  font: "inherit",
                  cursor: "pointer",
                  color: "var(--color-text-muted)",
                }}
              >
                Never mind
              </button>
            </div>
          </form>
        ) : (
          <div>
            <CtaButton
              onClick={() => setMode("refund-form")}
              variant="secondary"
            >
              Request a refund
            </CtaButton>
          </div>
        )}
        {error && (
          <p
            style={{
              margin: 0,
              color: "var(--color-error)",
              fontSize: "var(--fs-small)",
            }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  if (selfService.refundWindowClosed) {
    return (
      <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
        The refund window for this order has closed. See our {policyLink}, or
        contact support if something is wrong.
      </p>
    );
  }

  return null;
}
