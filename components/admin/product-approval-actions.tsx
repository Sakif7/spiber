"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProductApprovalActions({ productId }: { productId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  async function call(body: Record<string, unknown>, tag: string) {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/sellers/products/${productId}/approval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error?.code ?? "Action failed.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && <p className="text-destructive text-xs">{error}</p>}
      {showReason && (
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason"
          className="max-w-[16rem]"
        />
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          disabled={busy === "approve"}
          onClick={() => call({ status: "approved" }, "approve")}
        >
          {busy === "approve" ? "Working…" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy === "reject"}
          onClick={() => {
            if (!showReason) {
              setShowReason(true);
              return;
            }
            call({ status: "rejected", reason: reason.trim() }, "reject");
          }}
        >
          {busy === "reject" ? "Working…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}
