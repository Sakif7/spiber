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

export type RateRow = {
  rateLabel: string;
  effectiveFrom: string;
  effectiveLabel: string;
  note: string | null;
  addedAt: string;
};

/**
 * The history of someone's revenue share.
 *
 * Changing a percentage adds an entry rather than editing one, so a payroll
 * month already approved keeps the rate it was actually paid at.
 */
export function RateHistory({
  employeeId,
  payScheme,
  rates,
}: {
  employeeId: string;
  payScheme: string;
  rates: RateRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState("");
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
            rateBp: Math.round(Number(percent) * 100),
            effectiveFrom: from,
            note,
          }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "Could not set the share."));
        return;
      }
      toast.success("New share recorded.");
      setOpen(false);
      setPercent("");
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

  return (
    <>
      <DetailCard
        title="Revenue share"
        action={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" />
            Set new
          </Button>
        }
      >
        {rates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No share agreed yet — this person is not on any payroll run.
          </p>
        ) : (
          <div className="grid gap-2">
            {rates.map((r, i) => (
              <div
                key={`${r.effectiveFrom}-${i}`}
                className="flex items-baseline justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"
              >
                <span>
                  <span className="font-medium">{r.rateLabel}</span>
                  <span className="text-muted-foreground block text-xs">
                    from {r.effectiveLabel}
                    {i === 0 ? " · current" : ""}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {r.note ?? `added ${r.addedAt}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </DetailCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set a new revenue share</DialogTitle>
            <DialogDescription>
              Months already approved keep the rate they were paid at.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rate-pct">Share (%)</Label>
              <Input
                id="rate-pct"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                inputMode="decimal"
                placeholder="20"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rate-from">From month</Label>
              <Input
                id="rate-from"
                type="month"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rate-note">Note</Label>
              <Input
                id="rate-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="Board decision, revised terms…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !percent.trim()} onClick={add}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
