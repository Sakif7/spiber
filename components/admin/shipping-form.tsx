"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { fromMinor, toMinor } from "@/lib/money";
import { formatApiError } from "@/lib/http/form-error";

export function ShippingForm({
  initialFlatFeeMinor,
  initialFreeThresholdMinor,
}: {
  initialFlatFeeMinor: number;
  initialFreeThresholdMinor: number | null;
}) {
  const router = useRouter();

  const [flatFee, setFlatFee] = useState(
    String(fromMinor(initialFlatFeeMinor)),
  );
  const [freeEnabled, setFreeEnabled] = useState(
    initialFreeThresholdMinor != null,
  );
  const [freeThreshold, setFreeThreshold] = useState(
    initialFreeThresholdMinor != null
      ? String(fromMinor(initialFreeThresholdMinor))
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const flatFeeMinor = toMinor(Number(flatFee) || 0);
    const freeThresholdMinor =
      freeEnabled && freeThreshold.trim() !== ""
        ? toMinor(Number(freeThreshold) || 0)
        : null;

    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flatFeeMinor, freeThresholdMinor }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);

    if (res.ok && json?.ok) {
      setSaved(true);
      router.refresh();
    } else {
      setError(formatApiError(json));
    }
  }

  const card: React.CSSProperties = {
    display: "grid",
    gap: "var(--s-5)",
    padding: "var(--s-6)",
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    borderRadius: "var(--r-lg)",
  };
  const field = { display: "grid", gap: 6 } as const;

  return (
    <div style={card}>
      <div style={field}>
        <Label>Flat shipping fee (BDT)</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={flatFee}
          onChange={(e) => {
            setFlatFee(e.target.value);
            setSaved(false);
          }}
        />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-2)",
          cursor: "pointer",
          fontSize: "var(--fs-body-sm)",
          color: "var(--color-text)",
        }}
      >
        <input
          type="checkbox"
          checked={freeEnabled}
          onChange={(e) => {
            setFreeEnabled(e.target.checked);
            setSaved(false);
          }}
        />
        Enable free shipping threshold
      </label>

      {freeEnabled && (
        <div style={field}>
          <Label>Free shipping over (BDT)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={freeThreshold}
            placeholder="e.g. 5000"
            onChange={(e) => {
              setFreeThreshold(e.target.value);
              setSaved(false);
            }}
          />
          <span
            style={{
              fontSize: "var(--fs-small)",
              color: "var(--color-text-muted)",
            }}
          >
            Orders at or above this subtotal ship free. Leave the box unchecked
            to always charge the flat fee.
          </span>
        </div>
      )}

      {error && (
        <p style={{ color: "var(--color-error)", margin: 0 }}>{error}</p>
      )}
      {saved && !error && (
        <p style={{ color: "var(--color-success)", margin: 0 }}>
          Settings saved.
        </p>
      )}

      <div>
        <CtaButton type="button" onClick={submit}>
          {saving ? "Saving…" : "Save settings"}
        </CtaButton>
      </div>
    </div>
  );
}
