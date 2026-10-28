"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField, FormGrid } from "@/components/admin/ui/form-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatApiError } from "@/lib/http/form-error";
import { useUnsavedGuard } from "@/components/admin/ui/unsaved-changes";
import {
  FEE_METHOD_LABEL,
  feeMethodEnum,
  type FeeMethod,
  type FeeRateVersion,
} from "@/lib/schemas/payment";

/** Same table chrome as the other detail tables. */
const TH = "text-muted-foreground h-9 px-3 font-semibold";
const TD = "px-3 py-2 align-middle";

const pct = (bp: number) => `${(bp / 100).toFixed(2)}%`;

/**
 * PayStation's fee per payment method, in force from a day. The company
 * bears the fee, so each payment's fee — worked out from the set in force the
 * day it settled, and frozen on it — is a cost in the sales report. A new set
 * never touches payments already taken.
 */
export function FeeRatesCard({
  versions,
  today,
}: {
  versions: FeeRateVersion[];
  today: string;
}) {
  const router = useRouter();
  const latest = versions[versions.length - 1] ?? null;
  const blank = Object.fromEntries(
    feeMethodEnum.options.map((m) => [
      m,
      latest ? (latest.rates[m] / 100).toFixed(2) : "",
    ]),
  ) as Record<FeeMethod, string>;
  const [from, setFrom] = useState(today);
  const [rates, setRates] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = feeMethodEnum.options.some((m) => rates[m] !== blank[m]);

  async function save() {
    const parsed: Partial<Record<FeeMethod, number>> = {};
    for (const m of feeMethodEnum.options) {
      const n = Number(rates[m]);
      if (rates[m].trim() === "" || !Number.isFinite(n) || n < 0 || n > 10) {
        setError(
          `Enter ${FEE_METHOD_LABEL[m]} as a percentage between 0 and 10.`,
        );
        return;
      }
      parsed[m] = Math.round(n * 100);
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/company/payments/fee-rates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, rates: parsed }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (res.ok && json?.ok) {
      toast.success("Fee rates saved.");
      router.refresh();
    } else {
      setError(formatApiError(json));
    }
  }

  async function remove(day: string) {
    const res = await fetch("/api/admin/company/payments/fee-rates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: day }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok) {
      toast.success("Rates removed.");
      router.refresh();
    } else {
      toast.error(json?.error?.message ?? formatApiError(json));
    }
  }

  useUnsavedGuard(dirty, save);

  return (
    <Card className="grid gap-5 p-6">
      {versions.length ? (
        <div className="-mx-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={TH}>From</TableHead>
                {feeMethodEnum.options.map((m) => (
                  <TableHead key={m} className={`${TH} text-right`}>
                    {FEE_METHOD_LABEL[m]}
                  </TableHead>
                ))}
                <TableHead className={TH} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...versions].reverse().map((v) => (
                <TableRow key={v.from}>
                  <TableCell className={`${TD} whitespace-nowrap`}>
                    {v.from}
                  </TableCell>
                  {feeMethodEnum.options.map((m) => (
                    <TableCell
                      key={m}
                      className={`${TD} text-right tabular-nums`}
                    >
                      {pct(v.rates[m])}
                    </TableCell>
                  ))}
                  <TableCell className={`${TD} text-right`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(v.from)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-muted-foreground m-0 text-sm">
          No rates yet. Copy them from your PayStation agreement or merchant
          panel.
        </p>
      )}

      <div className="grid gap-4 border-t pt-4">
        <h3 className="text-foreground m-0 text-sm font-semibold">
          {latest ? "New rates" : "First rates"}
        </h3>
        <FormField
          label="In force from"
          hint="A set starting the same day replaces it. Payments already taken keep the fee they settled with."
        >
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="max-w-48"
          />
        </FormField>
        <FormGrid cols={3}>
          {feeMethodEnum.options.map((m) => (
            <FormField key={m} label={`${FEE_METHOD_LABEL[m]} (%)`}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={10}
                step={0.01}
                value={rates[m]}
                placeholder="e.g. 1.85"
                onChange={(e) =>
                  setRates((r) => ({ ...r, [m]: e.target.value }))
                }
              />
            </FormField>
          ))}
        </FormGrid>
        {error && <p className="text-destructive m-0 text-sm">{error}</p>}
        <div>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save rates"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
