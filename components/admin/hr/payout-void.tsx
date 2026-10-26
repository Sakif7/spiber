"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DetailCard } from "@/components/admin/ui/detail";
import { formatApiError } from "@/lib/http/form-error";

const MESSAGES: Record<string, string> = {
  not_latest:
    "Only someone's latest payout can be voided — void the later one first.",
  salary_moved:
    "Their salary has moved on since (a later payout, or “Salary paid up to” was changed), so this cannot be undone safely.",
  not_paid: "This payout is not paid, so there is nothing to void.",
};

/**
 * Void a payout recorded by mistake. Everything it paid becomes due again;
 * the payout itself stays on record, marked voided, with the reason.
 */
export function PayoutVoid({
  id,
  interrupted,
}: {
  id: string;
  /** It never finished recording: voiding gives back what it had taken. */
  interrupted: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function voidIt() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/company/hr/payouts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void", reason }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = (json as { error?: { code?: string } } | null)?.error
          ?.code;
        toast.error(
          (code && MESSAGES[code]) ??
            formatApiError(json, "The payout was not voided."),
        );
        return;
      }
      toast.success("Payout voided. What it paid is due again.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DetailCard
      title={interrupted ? "Interrupted" : "Recorded by mistake?"}
      description={
        interrupted
          ? "This payout stopped half-way through being recorded. Voiding it gives back whatever it had taken, so it can be paid again."
          : "Voiding puts everything it paid back as due. Do this only if the money did not go, or went to the wrong person."
      }
    >
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Why it is being voided"
        aria-label="Reason"
      />
      <Button
        variant="outline"
        className="text-destructive gap-1.5 justify-self-start"
        disabled={busy || reason.trim().length === 0}
        onClick={voidIt}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Undo2 className="size-4" />
        )}
        Void payout
      </Button>
    </DetailCard>
  );
}
