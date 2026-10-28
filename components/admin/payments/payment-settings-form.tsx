"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatApiError } from "@/lib/http/form-error";
import { useUnsavedGuard } from "@/components/admin/ui/unsaved-changes";
import {
  EMI_MIN_MINOR,
  LIVE_PAYMENT_POINTS,
  PAYMENT_POINT_LABEL,
  paymentPointEnum,
  type PaymentPoint,
} from "@/lib/schemas/payment";
import { formatBDT } from "@/lib/money";

/**
 * Where customers may pay online, one switch per door, plus EMI. Every door
 * starts off; one not built yet cannot be switched on.
 */
export function PaymentSettingsForm({
  initial,
  hasFeeRates,
}: {
  initial: { points: Record<PaymentPoint, boolean>; emi: boolean };
  hasFeeRates: boolean;
}) {
  const router = useRouter();
  const [points, setPoints] = useState(initial.points);
  const [emi, setEmi] = useState(initial.emi);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    emi !== initial.emi ||
    paymentPointEnum.options.some((p) => points[p] !== initial.points[p]);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/company/payments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points, emi }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      toast.success("Payment settings saved.");
      router.refresh();
    } else {
      const msg = json?.error?.message ?? formatApiError(json);
      setError(msg);
      toast.error(msg);
    }
  }

  useUnsavedGuard(dirty, submit);

  return (
    <Card className="grid gap-5 p-6">
      {!hasFeeRates ? (
        <p className="m-0 text-sm text-[var(--tone-warning-fg)]">
          Enter PayStation&apos;s fee rates below before switching anything on:
          every payment&apos;s fee is a cost in the sales report.
        </p>
      ) : null}

      <div className="grid gap-3">
        {paymentPointEnum.options.map((p) => {
          const built = LIVE_PAYMENT_POINTS.includes(p);
          return (
            <div key={p} className="grid gap-1">
              <div className="flex items-center gap-2">
                <Switch
                  id={`point-${p}`}
                  checked={points[p]}
                  disabled={!built && !points[p]}
                  onCheckedChange={(v) => setPoints((s) => ({ ...s, [p]: v }))}
                />
                <Label htmlFor={`point-${p}`}>{PAYMENT_POINT_LABEL[p]}</Label>
              </div>
              {!built ? (
                <span className="text-muted-foreground pl-11 text-xs">
                  Comes with a later phase of the PayStation work.
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="grid gap-1.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <Switch id="payments-emi" checked={emi} onCheckedChange={setEmi} />
          <Label htmlFor="payments-emi">
            Offer EMI on PayStation&apos;s page
          </Label>
        </div>
        <span className="text-muted-foreground text-xs">
          Instalments by card, for payments of {formatBDT(EMI_MIN_MINOR, "en")}{" "}
          or more (PayStation&apos;s minimum). Check what EMI costs you with
          PayStation before switching it on.
        </span>
      </div>

      {error && <p className="text-destructive m-0 text-sm">{error}</p>}
      <div>
        <Button type="button" onClick={submit} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save payment settings"}
        </Button>
      </div>
    </Card>
  );
}
