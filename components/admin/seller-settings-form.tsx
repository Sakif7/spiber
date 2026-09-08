"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CategoryRow = {
  id: string;
  name: string;
  depth: number;
  /** Current rate in %, or"" when inheriting. */
  rate: string;
};

/**
 * Seller-commission settings — the platform default (the"Spiber cut") plus
 * optional per-category rates. Precedence at accrual time:
 * per-seller override → category rate (inheriting from parents) → default.
 */
export function SellerSettingsForm({
  initialGlobalPct,
  categories,
}: {
  initialGlobalPct: string;
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [globalPct, setGlobalPct] = useState(initialGlobalPct);
  const [rows, setRows] = useState<CategoryRow[]>(categories);
  const [busy, setBusy] = useState(false);

  function setRate(id: string, rate: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, rate } : r)));
  }

  async function save() {
    const globalNum = Number(globalPct);
    if (
      globalPct.trim() === "" ||
      Number.isNaN(globalNum) ||
      globalNum < 0 ||
      globalNum > 100
    ) {
      toast.error("Enter a default commission between 0 and 100%.");
      return;
    }
    for (const r of rows) {
      if (r.rate.trim() === "") continue;
      const n = Number(r.rate);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        toast.error(`"${r.name}" needs a rate between 0 and 100% (or blank).`);
        return;
      }
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/sellers/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionBp: Math.round(globalNum * 100),
          categoryRates: rows.map((r) => ({
            categoryId: r.id,
            commissionBp:
              r.rate.trim() === "" ? null : Math.round(Number(r.rate) * 100),
          })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        toast.success("Commission settings saved.");
        router.refresh();
      } else {
        toast.error(json?.error?.code ?? "Could not save settings.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border">
        <CardHeader>
          <CardTitle>Platform default commission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground text-sm">
            The Spiber cut on every seller sale unless a category rate or a
            per-seller negotiated rate applies.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={globalPct}
              onChange={(e) => setGlobalPct(e.target.value)}
              className="max-w-[8rem]"
              aria-label="Default commission percent"
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader>
          <CardTitle>Per-category rates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground text-sm">
            Leave blank to inherit (subcategories inherit from their parent,
            then the default). A seller&apos;s negotiated rate always wins over
            these.
          </p>
          <div className="divide-border/60 divide-y">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span
                  className="text-foreground min-w-0 truncate text-sm"
                  style={{ paddingLeft: r.depth * 18 }}
                >
                  {r.depth > 0 && (
                    <span className="text-muted-foreground mr-1">└</span>
                  )}
                  {r.name}
                </span>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={r.rate}
                    placeholder="inherit"
                    onChange={(e) => setRate(r.id, e.target.value)}
                    className="w-24"
                    aria-label={`${r.name} commission percent`}
                  />
                  <span className="text-muted-foreground text-xs">%</span>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <p className="text-muted-foreground py-2 text-sm">
                No marketplace categories yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
