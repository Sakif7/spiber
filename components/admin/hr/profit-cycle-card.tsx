"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { Cycle } from "@/lib/hr/cycles";
import {
  CycleEditor,
  cycleOf,
  draftError,
  draftFromCycle,
  type CycleDraft,
} from "./cycle-editor";

/**
 * How often profit is worked out and split — the company's one profit cycle.
 *
 * Sits above the periods it cuts, the way the share pool sits above the
 * people it is split between. The dialog says in one line what a longer
 * period does, because that is the whole reason to change it.
 */
export function ProfitCycleCard({
  cycle,
  description,
  since,
  planned,
  floor,
  suggestedFrom,
}: {
  /** The cycle in force today. */
  cycle: Cycle;
  description: string;
  /** "1 Nov 2026" — when it took over, or null for calendar months always. */
  since: string | null;
  /** "Every 2 months from 1 Jan 2027", when a change is already planned. */
  planned: string | null;
  /** The first day a change may start: after every period on record. */
  floor: string | null;
  /** Where the dialog's start day begins. */
  suggestedFrom: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CycleDraft>(() =>
    draftFromCycle(cycle, suggestedFrom),
  );
  const error = draftError(draft, floor);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/company/hr/profit-cycle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: draft.from, cycle: cycleOf(draft) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (json as { error?: { code?: string } } | null)?.error
          ?.code;
        toast.error(
          code === "cycle_locked"
            ? "That day falls inside a period already on record. Pick a later day."
            : formatApiError(json, "Could not save the profit cycle."),
        );
        return;
      }
      toast.success("Profit cycle saved.");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionCard
        title="Profit split"
        description="How often profit is worked out and split between the shareholders."
        action={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setDraft(draftFromCycle(cycle, suggestedFrom));
              setOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Change
          </Button>
        }
      >
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs">Every</dt>
            <dd className="font-medium">{description}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Since</dt>
            <dd className="font-medium">{since ?? "Always"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Planned</dt>
            <dd className="font-medium">{planned ?? "—"}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground mt-3 text-xs">
          Each period stands alone: one that does not cover its salaries pays no
          share, and owes nothing. A longer period lets its good months cover
          its bad ones. When people are paid is set by their pay schedule on the
          Payouts page.
        </p>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Profit split</DialogTitle>
            <DialogDescription>
              Example: November falls ৳20,000 short of salaries and December
              makes ৳1,00,000. Split monthly, the directors share ৳1,00,000 and
              the company keeps November&apos;s loss. Split every 2 months, they
              share ৳80,000 — December pays November back first.
            </DialogDescription>
          </DialogHeader>
          <CycleEditor
            value={draft}
            onChange={setDraft}
            minFrom={floor}
            idPrefix="profit-cycle"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || error !== null} onClick={save}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
