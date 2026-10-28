"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/lib/http/form-error";

/**
 * Ask the gateway again about every try that could still be money, and apply
 * what it says — for a customer who says they paid while the order shows unpaid.
 */
export function RecheckPaymentButton({ url }: { url: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function recheck() {
    setBusy(true);
    const res = await fetch(url, { method: "POST" }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !json?.ok) {
      toast.error(
        json?.error?.code === "gateway_unreachable"
          ? "PayStation could not be reached. Try again in a moment."
          : formatApiError(json),
      );
      return;
    }
    const results: string[] = json.data.results ?? [];
    toast.success(
      results.includes("paid")
        ? "PayStation confirmed a payment; this page is updated."
        : results.includes("needs_refund")
          ? "A payment arrived that cannot be applied; it is listed for a refund."
          : results.length === 0
            ? "Nothing left to check."
            : "PayStation has no payment for this yet.",
    );
    router.refresh();
  }

  return (
    <Button size="sm" variant="outline" onClick={recheck} disabled={busy}>
      {busy ? "Checking…" : "Re-check with PayStation"}
    </Button>
  );
}
