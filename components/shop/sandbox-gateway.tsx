"use client";

import { useState } from "react";

/**
 * The sandbox gateway's payment page. It plays the part of the acquirer's
 * hosted page so the whole online-payment loop can be walked through before a
 * merchant account exists: pay, fail, or walk away, and see what each does to
 * the order.
 */
export function SandboxGateway({
  orderNumber,
  amountMinor,
  amountLabel,
  returnUrl,
  cancelUrl,
}: {
  orderNumber: string;
  amountMinor: number;
  amountLabel: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const [busy, setBusy] = useState<"paid" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function settle(outcome: "paid" | "failed") {
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch("/api/payments/sandbox/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderNumber, amountMinor, outcome }),
      });
      if (!res.ok) throw new Error(`sandbox returned ${res.status}`);
      window.location.assign(returnUrl);
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Could not reach the sandbox.");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-md gap-5 rounded-xl bg-white p-6 shadow-[var(--shadow-md)]">
      <div className="grid gap-1">
        <p className="font-mono text-[11px] tracking-[0.14em] text-[var(--color-text-muted)] uppercase">
          Sandbox gateway
        </p>
        <h1 className="text-xl font-bold text-[var(--color-text-strong)]">
          Confirm payment
        </h1>
        <p className="text-[13px] text-[var(--color-text-muted)]">
          No money moves here. This stands in for the real gateway so the
          payment flow can be tested end to end.
        </p>
      </div>

      <dl className="grid gap-2 rounded-lg bg-[var(--color-surface-2)] p-4 text-[13px]">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--color-text-muted)]">Order</dt>
          <dd className="font-mono">{orderNumber}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--color-text-muted)]">Amount</dt>
          <dd className="font-semibold tabular-nums">{amountLabel}</dd>
        </div>
      </dl>

      {error && (
        <p role="alert" className="text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => settle("paid")}
          disabled={busy !== null}
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy === "paid" ? "Paying…" : `Pay ${amountLabel}`}
        </button>
        <button
          type="button"
          onClick={() => settle("failed")}
          disabled={busy !== null}
          className="rounded-lg border border-[var(--color-border-field)] px-4 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {busy === "failed" ? "Declining…" : "Simulate a declined card"}
        </button>
        <a
          href={cancelUrl}
          className="px-4 py-2 text-center text-[13px] text-[var(--color-text-muted)] underline"
        >
          Abandon the payment
        </a>
      </div>

      <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
        Abandoning leaves the order awaiting payment. Its reserved stock is
        released automatically once the hold expires.
      </p>
    </div>
  );
}
