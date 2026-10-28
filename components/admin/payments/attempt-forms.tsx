"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { FormField, SaveBar } from "@/components/admin/ui/form-shell";
import { useAfterSave } from "@/components/admin/ui/form-panel";
import { formatApiError } from "@/lib/http/form-error";
import { fromMinor, toMinor } from "@/lib/money";

/**
 * Money waiting under Needs refund went back by hand (PayStation has no
 * refund API): record how, so the queue and the books agree.
 */
export function RecordRefundForm({
  attemptId,
  amountLabel,
}: {
  attemptId: string;
  amountLabel: string;
}) {
  const afterSave = useAfterSave();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(
      `/api/admin/company/payments/attempts/${attemptId}/refund`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: reference.trim(),
          note: note.trim() || undefined,
        }),
      },
    );
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok || !json?.ok) {
      setError(formatApiError(json));
      return;
    }
    toast.success(`Refund of ${amountLabel} recorded.`);
    afterSave(null);
  }

  return (
    <div className="grid gap-4">
      {/* One string: split over JSX lines, the space after the amount was
          dropped in the compiled output ("৳530to the customer"). */}
      <p className="text-muted-foreground text-sm">
        {`Return ${amountLabel} to the customer first (bKash, bank, or PayStation's merchant panel). Recording it here moves no money.`}
      </p>
      <FormField
        label="Refund reference"
        required
        hint="The bKash TrxID or bank reference of the money you sent back."
      >
        <Input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          autoComplete="off"
        />
      </FormField>
      <FormField label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
      <SaveBar
        saving={saving}
        onSave={save}
        saveLabel="Record refund"
        error={error}
        disabled={reference.trim().length < 2}
      />
    </div>
  );
}

/**
 * Set one payment's fee to PayStation's statement. The fee was worked out
 * from the rate table when the payment settled; this replaces it for this
 * payment only.
 */
export function CorrectFeeForm({
  attemptId,
  feeMinor,
}: {
  attemptId: string;
  feeMinor: number | null;
}) {
  const afterSave = useAfterSave();
  const [fee, setFee] = useState(
    feeMinor != null ? String(fromMinor(feeMinor)) : "",
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const major = Number(fee);
    if (!Number.isFinite(major) || major < 0) {
      setError("Enter the fee in taka, e.g. 18.50.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(
      `/api/admin/company/payments/attempts/${attemptId}/fee`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeMinor: toMinor(major),
          note: note.trim() || undefined,
        }),
      },
    );
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok || !json?.ok) {
      setError(formatApiError(json));
      return;
    }
    toast.success("Fee updated.");
    afterSave(null);
  }

  return (
    <div className="grid gap-4">
      <FormField
        label="Fee (BDT)"
        required
        hint="As on PayStation's settlement statement. The sales report uses this figure from now on."
      >
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />
      </FormField>
      <FormField label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
      <SaveBar
        saving={saving}
        onSave={save}
        saveLabel="Save fee"
        error={error}
      />
    </div>
  );
}
