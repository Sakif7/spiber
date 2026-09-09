"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DetailCard } from "@/components/admin/ui/detail";
import { formatApiError } from "@/lib/http/form-error";

type CostRow = { id?: string; label: string; amount: string; note?: string };
type LineRow = { id: string; description: string; cost: string };

const toMinor = (taka: string) => Math.round((Number(taka) || 0) * 100);
const money = (minor: number) =>
  `৳${(minor / 100).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

/**
 * What the sale cost us, beyond the goods.
 *
 * Two different things live here, and they are separate on purpose:
 *
 *  COSTS THE ORDER CARRIED — delivery, a courier, installation. These never
 *  appeared on the client's invoice, so they can be added at any time, which
 *  matters because a freight bill usually turns up weeks after the sale.
 *
 *  AMENDING WHAT A LINE COST — correcting a purchase price that was wrong or
 *  unknown. Also allowed after the order locks, for the same reason: our cost
 *  is not on the client's paper, so changing it cannot put the report out of
 *  step with a document they already hold. What they were CHARGED stays fixed.
 *
 * Both write to the order's history and the audit log; amending demands a
 * reason, because an auditor's first question about a changed figure is why.
 */
export function OrderCostsPanel({
  orderId,
  initialCosts,
  lines,
  grossProfitMinor,
}: {
  orderId: string;
  initialCosts: { id: string; label: string; amountMinor: number }[];
  lines: { id: string; description: string; unitCostMinor: number | null }[];
  /** Revenue less what the lines cost, so net can be shown as it is edited. */
  grossProfitMinor: number;
}) {
  const router = useRouter();
  const [costs, setCosts] = useState<CostRow[]>(
    initialCosts.map((c) => ({
      id: c.id,
      label: c.label,
      amount: String(c.amountMinor / 100),
    })),
  );
  const [amending, setAmending] = useState(false);
  const [lineCosts, setLineCosts] = useState<LineRow[]>(
    lines.map((l) => ({
      id: l.id,
      description: l.description,
      cost: l.unitCostMinor == null ? "" : String(l.unitCostMinor / 100),
    })),
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const totalCosts = costs.reduce((t, c) => t + toMinor(c.amount), 0);

  async function post(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/company/sales/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(formatApiError(json, "That didn't work."));
        return false;
      }
      toast.success(ok);
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <DetailCard title="What this sale cost us">
      <div className="grid gap-4">
        <div className="grid gap-2">
          {costs.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={c.label}
                placeholder="Delivery, courier, installation…"
                onChange={(e) =>
                  setCosts((p) =>
                    p.map((x, n) =>
                      n === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
                className="h-8"
              />
              <Input
                value={c.amount}
                inputMode="decimal"
                placeholder="৳"
                onChange={(e) =>
                  setCosts((p) =>
                    p.map((x, n) =>
                      n === i ? { ...x, amount: e.target.value } : x,
                    ),
                  )
                }
                className="h-8 w-28 text-right"
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${c.label || "cost"}`}
                className="text-destructive size-8 shrink-0"
                onClick={() => setCosts((p) => p.filter((_, n) => n !== i))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setCosts((p) => [...p, { label: "", amount: "" }])}
            >
              <Plus className="size-4" aria-hidden />
              Add a cost
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void post(
                  {
                    action: "costs",
                    costs: costs
                      .filter((c) => c.label.trim())
                      .map((c) => ({
                        id: c.id,
                        label: c.label.trim(),
                        amountMinor: toMinor(c.amount),
                      })),
                  },
                  "Costs saved.",
                )
              }
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save costs
            </Button>
          </div>
        </div>

        <dl className="border-border grid gap-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Gross profit</dt>
            <dd className="tabular-nums">{money(grossProfitMinor)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Costs on this order</dt>
            <dd className="tabular-nums">−{money(totalCosts)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Net on this sale</dt>
            <dd className="tabular-nums">
              {money(grossProfitMinor - totalCosts)}
            </dd>
          </div>
        </dl>

        <div className="border-border border-t pt-3">
          {!amending ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAmending(true)}
            >
              Amend what a line cost
            </Button>
          ) : (
            <div className="grid gap-2">
              <p className="text-muted-foreground text-xs">
                Corrects our own cost only. What the client was charged is on an
                invoice they already hold and does not change here.
              </p>
              {lineCosts.map((l, i) => (
                <div key={l.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {l.description}
                  </span>
                  <Input
                    value={l.cost}
                    inputMode="decimal"
                    placeholder="—"
                    onChange={(e) =>
                      setLineCosts((p) =>
                        p.map((x, n) =>
                          n === i ? { ...x, cost: e.target.value } : x,
                        ),
                      )
                    }
                    className="h-8 w-28 text-right"
                  />
                </div>
              ))}
              <div className="grid gap-1.5">
                <Label htmlFor="amend-reason">Why</Label>
                <Input
                  id="amend-reason"
                  value={reason}
                  placeholder="Supplier invoice arrived at a different price"
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy || !reason.trim()}
                  onClick={async () => {
                    const done = await post(
                      {
                        action: "amend-costs",
                        reason: reason.trim(),
                        lines: lineCosts.map((l) => ({
                          id: l.id,
                          unitCostMinor: l.cost.trim() ? toMinor(l.cost) : null,
                        })),
                      },
                      "Costs amended.",
                    );
                    if (done) {
                      setAmending(false);
                      setReason("");
                    }
                  }}
                >
                  {busy && (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  )}
                  Save amendment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAmending(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DetailCard>
  );
}
