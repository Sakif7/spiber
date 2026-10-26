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
import { formatApiError } from "@/lib/http/form-error";

/**
 * "Salary paid up to": for someone paid outside the system before they were
 * put on it, so their first payout does not pay those days again.
 */
export function SalaryPaidThrough({
  employeeId,
  through,
  min,
  today,
}: {
  employeeId: string;
  /** The last day already paid, as the date input wants it, or "". */
  through: string;
  /** The earliest day it may be set to: a payout already paid up to there. */
  min: string | null;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(through || today);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/company/hr/employees/${employeeId}/salary-paid-through`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ through: value }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (json as { error?: { code?: string } } | null)?.error
          ?.code;
        toast.error(
          code === "before_payout"
            ? "A payout has already paid salary past that day. Pick a later one."
            : formatApiError(json, "Could not save."),
        );
        return;
      }
      toast.success("Saved.");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 justify-self-start"
        onClick={() => {
          setValue(through || today);
          setOpen(true);
        }}
      >
        <Pencil className="size-4" />
        Salary paid up to…
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salary paid up to</DialogTitle>
            <DialogDescription>
              The last day of salary they have already been paid, outside the
              system. Their next payout starts the day after.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="salary-through">Paid up to and including</Label>
            <Input
              id="salary-through"
              type="date"
              value={value}
              min={min ?? undefined}
              onChange={(e) => setValue(e.target.value)}
              className="sm:max-w-56"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !value} onClick={save}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
