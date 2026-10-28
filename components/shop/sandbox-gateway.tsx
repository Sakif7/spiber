"use client";

import { useState } from "react";

type Outcome = "paid" | "failed" | "cancelled";

/**
 * The sandbox gateway's payment page. It plays PayStation's hosted checkout so
 * the whole online-payment loop can be walked through without a merchant
 * account: pay, decline, or cancel, and land back on the order exactly as a
 * PayStation customer would.
 */
export function SandboxGateway({
  invoiceNumber,
  reference,
  amountLabel,
  alreadyPaid,
}: {
  invoiceNumber: string;
  reference: string | null;
  amountLabel: string;
  alreadyPaid: boolean;
}) {
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function settle(outcome: Outcome) {
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch("/api/payments/sandbox/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceNumber, outcome }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok)
        throw new Error(`sandbox returned ${res.status}`);
      window.location.assign(json.data.callbackUrl);
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
          No money moves here. This stands in for PayStation&apos;s page so the
          payment flow can be tested end to end.
        </p>
      </div>

      <dl className="grid gap-2 rounded-lg bg-[var(--color-surface-2)] p-4 text-[13px]">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--color-text-muted)]">Invoice</dt>
          <dd className="font-mono">{invoiceNumber}</dd>
        </div>
        {reference ? (
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-text-muted)]">Order</dt>
            <dd className="font-mono">{reference}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--color-text-muted)]">Amount</dt>
          <dd className="font-semibold tabular-nums">{amountLabel}</dd>
        </div>
      </dl>

      {alreadyPaid ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">
          This invoice is already paid.
        </p>
      ) : null}

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
        <button
          type="button"
          onClick={() => settle("cancelled")}
          disabled={busy !== null}
          className="px-4 py-2 text-center text-[13px] text-[var(--color-text-muted)] underline"
        >
          Cancel and go back
        </button>
      </div>

      <p className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
        Declining or cancelling leaves the order waiting for its money, with a
        &ldquo;Pay again&rdquo; button while its stock is held. The hold
        releases the stock automatically when it runs out.
      </p>
    </div>
  );
}
