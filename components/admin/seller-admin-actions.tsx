"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SellerAdminActions({
  sellerId,
  status,
  commissionBp,
}: {
  sellerId: string;
  status: "active" | "suspended";
  commissionBp: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commission, setCommission] = useState<string>(
    commissionBp != null ? String(commissionBp / 100) : "",
  );

  async function call(
    path: string,
    body: Record<string, unknown>,
    tag: string,
  ) {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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

  const nextStatus = status === "active" ? "suspended" : "active";

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg p-5 shadow-[var(--shadow-sm)]">
      <h2 className="text-foreground font-[family-name:var(--font-display)] text-lg">
        Actions
      </h2>
      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button
          variant={status === "active" ? "outline" : "default"}
          disabled={busy === "status"}
          onClick={() => call("status", { status: nextStatus }, "status")}
        >
          {busy === "status"
            ? "Working…"
            : status === "active"
              ? "Suspend seller"
              : "Reactivate seller"}
        </Button>
      </div>

      <div className="grid gap-1.5">
        <label className="text-foreground text-sm font-medium">
          Commission override (%)
        </label>
        <p className="text-muted-foreground text-xs">
          Leave blank to use the platform default.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            placeholder="Default"
            className="max-w-[10rem]"
          />
          <Button
            variant="outline"
            disabled={busy === "commission"}
            onClick={() => {
              const trimmed = commission.trim();
              call(
                "commission",
                {
                  commissionBp:
                    trimmed === "" ? null : Math.round(Number(trimmed) * 100),
                },
                "commission",
              );
            }}
          >
            {busy === "commission" ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </section>
  );
}
