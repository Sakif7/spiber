"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { EmptyState } from "@/components/admin/ui/empty-state";

type Available = {
  sellerId: string;
  sellerName: string;
  amountLabel: string;
  count: number;
  commissionIds: string[];
};

type Payout = {
  id: string;
  payoutNumber: string;
  sellerName: string;
  amountLabel: string;
  status: string;
};

export function PayoutManager({
  available,
  payouts,
}: {
  available: Available[];
  payouts: Payout[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(
    path: string,
    body: Record<string, unknown>,
    tag: string,
  ) {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error?.code ?? "Action failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-destructive text-sm">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-foreground font-[family-name:var(--font-display)] text-lg">
          Available to pay out
        </h2>
        {available.length === 0 ? (
          <div className="bg-card overflow-hidden rounded-xl border">
            <EmptyState title="No accrued earnings ready to pay out." />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {available.map((a) => (
              <div
                key={a.sellerId}
                className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <div className="text-foreground font-medium">
                    {a.sellerName}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    <span className="font-mono">{a.amountLabel}</span> ·{" "}
                    {a.count} commission{a.count === 1 ? "" : "s"}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={busy === a.sellerId || a.commissionIds.length === 0}
                  onClick={() =>
                    post(
                      "/api/admin/sellers/payouts",
                      {
                        sellerId: a.sellerId,
                        commissionIds: a.commissionIds,
                      },
                      a.sellerId,
                    )
                  }
                >
                  {busy === a.sellerId ? "Working…" : "Create payout"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-[family-name:var(--font-display)] text-lg">
          Payout history
        </h2>
        {payouts.length === 0 ? (
          <div className="bg-card overflow-hidden rounded-xl border">
            <EmptyState title="No payouts yet." />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {payouts.map((p) => (
              <div
                key={p.id}
                className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <div className="text-primary font-mono text-xs font-medium">
                    {p.payoutNumber}
                  </div>
                  <div className="text-foreground text-sm">
                    {p.sellerName} ·{" "}
                    <span className="font-mono">{p.amountLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge>{p.status}</StatusBadge>
                  {p.status !== "paid" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === p.id}
                      onClick={() =>
                        post(
                          `/api/admin/sellers/payouts/${p.id}/status`,
                          { status: "paid" },
                          p.id,
                        )
                      }
                    >
                      {busy === p.id ? "Working…" : "Mark paid"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
