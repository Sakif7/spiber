"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Check, X, Wallet, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/admin/ui/select-field";
import { DetailCard } from "@/components/admin/ui/detail";
import { formatApiError } from "@/lib/http/form-error";

type Status = "submitted" | "approved" | "rejected" | "reimbursed";

/**
 * Approving, rejecting and paying a claim.
 *
 * Which controls appear is driven entirely by the stored state, so the UI can
 * never offer an action the service would refuse — a claim settled by payroll
 * shows no "mark paid" button at all.
 */
export function ExpenseActions({
  id,
  status,
  settlement,
  payrollMonth,
  amountLabel,
}: {
  id: string;
  status: Status;
  settlement: "payroll" | "direct" | null;
  payrollMonth: string | null;
  amountLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");

  async function act(action: string, body: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/company/people/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "That did not go through."));
        return;
      }
      toast.success(
        action === "approve"
          ? "Claim approved."
          : action === "reject"
            ? "Claim rejected."
            : "Reimbursement recorded.",
      );
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (status === "reimbursed") {
    return (
      <DetailCard title="Settled">
        <p className="text-muted-foreground">
          {amountLabel} has been paid back
          {settlement === "payroll" && payrollMonth
            ? ` with the ${payrollMonth} payroll.`
            : "."}
        </p>
      </DetailCard>
    );
  }

  if (status === "rejected") {
    return (
      <DetailCard title="Rejected">
        <p className="text-muted-foreground">
          This claim was turned down. Record a fresh one if it was a mistake.
        </p>
      </DetailCard>
    );
  }

  return (
    <DetailCard title={status === "submitted" ? "Decide" : "Settlement"}>
      <div className="space-y-4">
        {error && <p className="text-destructive">{error}</p>}

        <div className="space-y-2">
          <p className="text-muted-foreground">
            {status === "submitted"
              ? "Approve this claim and choose how it gets paid back."
              : settlement === "payroll"
                ? `Waiting for the ${payrollMonth} payroll run. Approving that month pays it.`
                : "Waiting for a direct payout."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={settlement === "payroll" ? "default" : "outline"}
              disabled={busy !== null}
              onClick={() => act("approve", { settlement: "payroll" })}
            >
              <Wallet className="size-4" aria-hidden />
              {status === "submitted"
                ? "Approve — pay with payroll"
                : "Move to payroll"}
            </Button>
            <Button
              size="sm"
              variant={settlement === "direct" ? "default" : "outline"}
              disabled={busy !== null}
              onClick={() => act("approve", { settlement: "direct" })}
            >
              <Banknote className="size-4" aria-hidden />
              {status === "submitted"
                ? "Approve — pay separately"
                : "Move to a direct payout"}
            </Button>
          </div>
        </div>

        {status === "approved" && settlement === "direct" && (
          <div className="space-y-2 border-t pt-4">
            <p className="font-medium">Record the payout</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-36">
                <SelectField
                  value={method}
                  onChange={setMethod}
                  ariaLabel="Payment method"
                  options={[
                    { value: "cash", label: "Cash" },
                    { value: "bank", label: "Bank" },
                    { value: "mobile", label: "Mobile" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </div>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Reference (optional)"
                className="w-56"
                maxLength={120}
              />
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  act("reimburse", {
                    method,
                    reference: reference || undefined,
                  })
                }
              >
                <Check className="size-4" aria-hidden />
                Mark {amountLabel} paid
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <p className="font-medium">Turn it down</p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Why this is not being reimbursed"
          />
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={busy !== null || reason.trim().length === 0}
            onClick={() => act("reject", { reason })}
          >
            <X className="size-4" aria-hidden />
            Reject claim
          </Button>
        </div>
      </div>
    </DetailCard>
  );
}
