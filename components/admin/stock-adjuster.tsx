"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function StockAdjuster({
  productId,
  variantId = null,
}: {
  productId: string;
  /** Adjust one variant (its `Product.variants[].id`) instead of the base stock. */
  variantId?: string | null;
}) {
  const router = useRouter();
  const [qtyDelta, setQtyDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    setError(null);
    const delta = Number(qtyDelta);
    if (!qtyDelta.trim() || Number.isNaN(delta) || delta === 0) {
      setError("Enter a non-zero quantity");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          ...(variantId ? { variantId } : {}),
          qtyDelta: delta,
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const code = json?.error?.code ?? "request_failed";
        const message = json?.error?.message;
        setError(message ?? code);
        return;
      }
      setQtyDelta("");
      setReason("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1">
      <div className="flex flex-nowrap items-center gap-2">
        <Input
          type="number"
          value={qtyDelta}
          onChange={(e) => setQtyDelta(e.target.value)}
          placeholder="+/-"
          aria-label="Quantity change"
          className="h-8 w-16"
        />
        <Input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          aria-label="Reason"
          className="h-8 w-32"
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={busy}
          onClick={apply}
        >
          {busy ? "Applying…" : "Apply"}
        </Button>
      </div>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}
