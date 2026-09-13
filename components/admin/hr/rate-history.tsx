"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailCard } from "@/components/admin/ui/detail";
import { formatApiError } from "@/lib/http/form-error";

export type HoldingRow = {
  /** "2,000 shares" or, on a legacy row, "20%". */
  label: string;
  /** "14.29% of the pool", or null for a legacy row. */
  fraction: string | null;
  effectiveFrom: string;
  effectiveLabel: string;
  note: string | null;
  addedAt: string;
  legacy: boolean;
};

/**
 * The history of someone's shareholding.
 *
 * Changing a holding adds an entry rather than editing one, so a payroll month
 * already approved keeps the holding it was actually paid on. A row from the
 * percentage scheme this replaced is shown as it was, and flagged, until the
 * migration rewrites it.
 */
export function RateHistory({
  employeeId,
  payScheme,
  rates,
  pool,
}: {
  employeeId: string;
  payScheme: string;
  rates: HoldingRow[];
  /** The pool as of now: how many shares are issued and how many are free. */
  pool: { totalShares: number; unallocated: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shares, setShares] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 7));
  const [note, setNote] = useState("");

  async function add() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/company/hr/employees/${employeeId}/rates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shares: Math.round(Number(shares) || 0),
            effectiveFrom: from,
            note,
          }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (json as { error?: { code?: string } } | null)?.error
          ?.code;
        toast.error(
          code === "pool_exceeded"
            ? "That is more than the pool has left. Raise the pool first, or allocate fewer."
            : code === "no_pool"
              ? "Set the share pool on the employees page before allocating."
              : formatApiError(json, "Could not record the holding."),
        );
        return;
      }
      toast.success("Holding recorded.");
      setOpen(false);
      setShares("");
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (payScheme !== "revenue_share") {
    return (
      <DetailCard title="Pay">
        <p className="text-muted-foreground text-sm">
          {payScheme === "fixed"
            ? "Paid a fixed monthly amount."
            : "Not paid through payroll."}
        </p>
      </DetailCard>
    );
  }

  const noPool = pool.totalShares <= 0;

  return (
    <>
      <DetailCard
        title="Shareholding"
        action={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setOpen(true)}
            disabled={noPool}
            title={noPool ? "Set the share pool first" : undefined}
          >
            <Plus className="size-4" />
            Set new
          </Button>
        }
      >
        {rates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {noPool
              ? "No share pool has been set yet — set it on the employees page, then allocate from it."
              : "Holds no shares yet — this person is not on any payroll run."}
          </p>
        ) : (
          <div className="grid gap-2">
            {rates.map((r, i) => (
              <div
                key={`${r.effectiveFrom}-${i}`}
                className="flex items-baseline justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"
              >
                <span>
                  <span className="font-medium">{r.label}</span>
                  {r.fraction && (
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      {r.fraction}
                    </span>
                  )}
                  <span className="text-muted-foreground block text-xs">
                    from {r.effectiveLabel}
                    {i === 0 ? " · current" : ""}
                    {r.legacy ? " · percentage scheme, not migrated" : ""}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {r.note ?? `added ${r.addedAt}`}
                </span>
              </div>
            ))}
          </div>
        )}
        {!noPool && (
          <p className="text-muted-foreground mt-3 text-xs">
            Pool: {pool.totalShares.toLocaleString("en-BD")} shares,{" "}
            {pool.unallocated.toLocaleString("en-BD")} unallocated as of this
            month.
          </p>
        )}
      </DetailCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record a new holding</DialogTitle>
            <DialogDescription>
              Months already approved keep the holding they were paid on. This
              replaces the current holding from the month you choose — enter the
              total they hold, not the change.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="holding-shares">Shares held</Label>
              <Input
                id="holding-shares"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                inputMode="numeric"
                placeholder="2000"
              />
              <p className="text-muted-foreground text-xs">
                Of {pool.totalShares.toLocaleString("en-BD")} in the pool.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="holding-from">From month</Label>
              <Input
                id="holding-from"
                type="month"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                The first payroll month this counts for. Earlier months are
                untouched.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="holding-note">Note</Label>
              <Input
                id="holding-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="Board decision, share transfer…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !shares.trim()} onClick={add}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
