"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatApiError } from "@/lib/http/form-error";

/**
 * Inline row actions for a credit account: change net terms, suspend or
 * reactivate. Both take effect on the buyer's very next checkout, because
 * `placeOrder` reads the account fresh rather than trusting a token claim.
 */
export function CreditAccountActions({
  accountId,
  termsDays,
  status,
}: {
  accountId: string;
  termsDays: number;
  status: "active" | "suspended";
}) {
  const router = useRouter();
  const [terms, setTerms] = useState(String(termsDays));
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/credit/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        toast.error(formatApiError(json));
        return;
      }
      toast.success("Credit account updated.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const termsChanged = Number(terms) > 0 && Number(terms) !== termsDays;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-muted-foreground text-xs">Net</span>
      <Input
        type="number"
        min={1}
        max={365}
        value={terms}
        onChange={(e) => setTerms(e.target.value)}
        className="h-8 w-20"
        aria-label="Net payment terms in days"
      />
      {termsChanged ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => patch({ termsDays: Number(terms) })}
        >
          Save
        </Button>
      ) : null}
      <Button
        size="sm"
        variant={status === "active" ? "destructive" : "default"}
        disabled={busy}
        onClick={() =>
          patch({ status: status === "active" ? "suspended" : "active" })
        }
      >
        {status === "active" ? "Suspend" : "Reactivate"}
      </Button>
    </div>
  );
}
