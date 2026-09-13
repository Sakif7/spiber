"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
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
import { SectionCard } from "@/components/admin/ui/section-card";
import { formatApiError } from "@/lib/http/form-error";

const taka = (minor: number) => (minor / 100).toLocaleString("en-BD");

/**
 * The share pool, and how much of it is spoken for.
 *
 * Every director's monthly payout is their holding over this total, so the
 * card sits above the list of people it governs. Shrinking it below what is
 * already held is refused by the API, and the message says why.
 */
export function SharePoolCard({
  totalShares,
  faceValueMinor,
  allocated,
  directors,
}: {
  totalShares: number;
  faceValueMinor: number | null;
  /** Shares held by everyone as of this month. */
  allocated: number;
  /** How many directors hold something. */
  directors: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(totalShares ? String(totalShares) : "");
  const [face, setFace] = useState(
    faceValueMinor ? String(faceValueMinor / 100) : "",
  );

  const unallocated = Math.max(0, totalShares - allocated);
  const capital = faceValueMinor ? totalShares * faceValueMinor : null;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/company/hr/share-pool", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalShares: Math.round(Number(total) || 0),
          faceValueMinor: face.trim()
            ? Math.round((Number(face) || 0) * 100)
            : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (json as { error?: { code?: string } } | null)?.error
          ?.code;
        toast.error(
          code === "pool_exceeded"
            ? `Directors already hold ${allocated.toLocaleString("en-BD")} shares — the pool cannot be smaller than that.`
            : formatApiError(json, "Could not save the pool."),
        );
        return;
      }
      toast.success("Share pool saved.");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionCard
        title="Share pool"
        description="Every director's month is their holding over this total."
        action={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setOpen(true)}
          >
            <Pencil className="size-4" />
            {totalShares ? "Edit" : "Set pool"}
          </Button>
        }
      >
        {totalShares <= 0 ? (
          <p className="text-muted-foreground text-sm">
            Not set. Until it is, nobody can be allocated shares and no director
            is paid.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground text-xs">Issued</dt>
              <dd className="font-medium tabular-nums">
                {totalShares.toLocaleString("en-BD")} shares
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Held</dt>
              <dd className="font-medium tabular-nums">
                {allocated.toLocaleString("en-BD")}
                <span className="text-muted-foreground ml-1 text-xs">
                  by {directors} director{directors === 1 ? "" : "s"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Unallocated</dt>
              <dd className="font-medium tabular-nums">
                {unallocated.toLocaleString("en-BD")}
                <span className="text-muted-foreground ml-1 text-xs">
                  stays with the company
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Paid-up capital</dt>
              <dd className="font-medium tabular-nums">
                {capital == null
                  ? "—"
                  : `৳${taka(capital)} at ৳${taka(faceValueMinor ?? 0)} a share`}
              </dd>
            </div>
          </dl>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share pool</DialogTitle>
            <DialogDescription>
              The number of shares the company issued. Shares nobody holds leave
              their part of each month with the company — raise the pool above
              what the directors hold to keep a reserve.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pool-total">Shares issued</Label>
              <Input
                id="pool-total"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                inputMode="numeric"
                placeholder="14000"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pool-face">Face value per share (৳)</Label>
              <Input
                id="pool-face"
                value={face}
                onChange={(e) => setFace(e.target.value)}
                inputMode="decimal"
                placeholder="100"
              />
              <p className="text-muted-foreground text-xs">
                For the record only — it plays no part in the monthly split.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !total.trim()} onClick={save}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
