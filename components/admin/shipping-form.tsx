"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
      toast.success("Settings saved.");
      router.refresh();
    } else {
      const msg = formatApiError(json);
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <Card className="grid gap-5 p-6">
      <div className="grid gap-1.5">
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

      <label className="text-foreground flex cursor-pointer items-center gap-2 text-sm">
        <Switch
          checked={freeEnabled}
          onCheckedChange={(v) => {
            setFreeEnabled(v);
            setSaved(false);
          }}
        />
        Enable free shipping threshold
      </label>

      {freeEnabled && (
        <div className="grid gap-1.5">
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
          <span className="text-muted-foreground text-xs">
            Orders at or above this subtotal ship free. Leave the box unchecked
            to always charge the flat fee.
          </span>
        </div>
      )}

      {error && <p className="text-destructive m-0 text-sm">{error}</p>}
      {saved && !error && (
        <p className="m-0 text-sm text-[var(--tone-success-fg)]">
          Settings saved.
        </p>
      )}

      <div>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </Card>
  );
}
