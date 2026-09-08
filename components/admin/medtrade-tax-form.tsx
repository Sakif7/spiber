"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/http/form-error";

/** Percent (what the admin types) ⇄ basis points (what we store). */
const bpToPct = (bp: number) => String(bp / 100);
const pctToBp = (pct: string) => Math.round((Number(pct) || 0) * 100);

export function MedtradeTaxForm({
  initialVatRateBp,
  initialAitRateBp,
}: {
  initialVatRateBp: number;
  initialAitRateBp: number;
}) {
  const router = useRouter();

  const [vat, setVat] = useState(bpToPct(initialVatRateBp));
  const [ait, setAit] = useState(bpToPct(initialAitRateBp));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await fetch("/api/admin/settings/medtrade", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vatRateBp: pctToBp(vat),
        aitRateBp: pctToBp(ait),
      }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);

    if (res.ok && json?.ok) {
      setSaved(true);
      toast.success("Medtrade tax settings saved.");
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
        <Label>VAT rate (%)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={vat}
          placeholder="e.g. 15"
          onChange={(e) => {
            setVat(e.target.value);
            setSaved(false);
          }}
        />
        <span className="text-muted-foreground text-xs">
          Charged. Added as a VAT line to Medtrade order totals and invoices,
          calculated on the discounted goods subtotal (shipping excluded). Set 0
          to disable. Spiber Kart is unaffected.
        </span>
      </div>

      <div className="grid gap-1.5">
        <Label>AIT rate (%)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={ait}
          placeholder="e.g. 3"
          onChange={(e) => {
            setAit(e.target.value);
            setSaved(false);
          }}
        />
        <span className="text-muted-foreground text-xs">
          Informational only. Advance Income Tax is deducted at source by the
          buyer, so it never changes the amount charged — it is shown on the
          invoice as deductible. Set 0 to hide the note.
        </span>
      </div>

      {error && <p className="text-destructive m-0 text-sm">{error}</p>}
      {saved && !error && (
        <p className="m-0 text-sm text-[var(--tone-success-fg)]">
          Settings saved.
        </p>
      )}

      <div>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save tax settings"}
        </Button>
      </div>
    </Card>
  );
}
