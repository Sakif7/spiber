"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatApiError } from "@/lib/http/form-error";
import { cn } from "@/lib/cn";
import {
  MANUAL_TYPES,
  unitTitle,
  type HubUnit,
  type ManualType,
} from "./types";

type LineResult = {
  productId: string;
  variantId: string | null;
  ok: boolean;
  stockAfter?: number | null;
  error?: string;
};

const LINE_ERROR: Record<string, string> = {
  insufficient_stock: "not enough on hand",
  not_found: "unit not found",
  seller_managed: "seller-managed (override required)",
  failed: "failed",
};

/**
 * Bulk receive / adjust: one quantity per selected unit, applied in a single
 * request. Lines apply independently — failures are listed, the rest land.
 */
export function BulkDrawer({
  units,
  open,
  onOpenChange,
  onApplied,
}: {
  units: HubUnit[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        {open && (
          <BulkForm
            units={units}
            onClose={() => onOpenChange(false)}
            onApplied={onApplied}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function BulkForm({
  units,
  onClose,
  onApplied,
}: {
  units: HubUnit[];
  onClose: () => void;
  onApplied?: () => void;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [type, setType] = useState<ManualType>("purchase");
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<
    { unit: HubUnit; message: string }[]
  >([]);

  const hasSeller = units.some((u) => u.seller);
  const lines = units
    .map((u) => ({ unit: u, n: Number(qty[u.key] ?? "") }))
    .filter(
      ({ unit, n }) =>
        (qty[unit.key] ?? "").trim() !== "" && Number.isInteger(n) && n !== 0,
    );
  const invalid = units.some((u) => {
    const raw = (qty[u.key] ?? "").trim();
    if (raw === "") return false;
    const n = Number(raw);
    return !Number.isInteger(n) || u.stock + n < 0;
  });
  const blocked =
    hasSeller && !override && lines.some(({ unit }) => unit.seller);

  async function apply() {
    if (lines.length === 0 || invalid || blocked) return;
    setBusy(true);
    setError(null);
    setFailures([]);
    try {
      const res = await fetch("/api/admin/inventory/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          reason: reason.trim() || undefined,
          override: hasSeller ? override : undefined,
          source: "bulk",
          lines: lines.map(({ unit, n }) => ({
            productId: unit.productId,
            ...(unit.variantId ? { variantId: unit.variantId } : {}),
            qtyDelta: n,
          })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(formatApiError(json, "Could not apply the changes"));
        return;
      }
      const data = json.data as {
        applied: number;
        failed: number;
        lines: LineResult[];
      };
      const failed = data.lines
        .filter((l) => !l.ok)
        .map((l) => {
          const unit = units.find(
            (u) =>
              u.productId === l.productId &&
              (u.variantId ?? null) === (l.variantId ?? null),
          );
          return unit
            ? { unit, message: LINE_ERROR[l.error ?? "failed"] ?? "failed" }
            : null;
        })
        .filter((x): x is { unit: HubUnit; message: string } => x !== null);
      if (data.failed === 0) {
        toast.success(
          `${data.applied} unit${data.applied === 1 ? "" : "s"} updated`,
        );
        router.refresh();
        onApplied?.();
        onClose();
      } else {
        toast.warning(`${data.applied} applied, ${data.failed} failed`, {
          description: "The failed lines are listed in the drawer.",
        });
        setFailures(failed);
        router.refresh();
        onApplied?.();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="text-base">
          Receive or adjust {units.length} unit{units.length === 1 ? "" : "s"}
        </SheetTitle>
        <SheetDescription>
          Enter a change per unit (positive = received, negative = removed).
          Leave a line blank to skip it.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as ManualType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bulk-reason">Reason (optional)</Label>
            <Input
              id="bulk-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. PO 4471"
            />
          </div>
        </div>

        {hasSeller && (
          <label className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] px-3 py-2.5 text-[13px]">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--color-brand)]"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
            />
            <span>
              Some of these units are seller-managed. Override their balances
              and notify the sellers.
            </span>
          </label>
        )}

        <div className="bg-card divide-border/60 divide-y rounded-lg shadow-[var(--shadow-sm)]">
          {units.map((u) => {
            const raw = (qty[u.key] ?? "").trim();
            const n = raw === "" ? null : Number(raw);
            const bad = n !== null && (!Number.isInteger(n) || u.stock + n < 0);
            const failure = failures.find((f) => f.unit.key === u.key);
            return (
              <div
                key={u.key}
                className="flex items-center gap-3 px-3 py-2 text-[13px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{unitTitle(u)}</p>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {u.sku}
                    {u.seller ? ` · ${u.seller.name}` : ""}
                  </p>
                  {failure && (
                    <p className="text-destructive text-xs">
                      Failed: {failure.message}
                    </p>
                  )}
                </div>
                <span className="text-muted-foreground w-12 shrink-0 text-right font-mono tabular-nums">
                  {u.stock}
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  aria-label={`Change for ${u.sku}`}
                  value={qty[u.key] ?? ""}
                  onChange={(e) =>
                    setQty((prev) => ({ ...prev, [u.key]: e.target.value }))
                  }
                  placeholder="+/-"
                  className={cn(
                    "h-8 w-20 shrink-0",
                    bad && "border-destructive",
                  )}
                />
                <span
                  className={cn(
                    "w-12 shrink-0 text-right font-mono tabular-nums",
                    bad ? "text-destructive" : "text-foreground",
                  )}
                >
                  {n === null || !Number.isInteger(n) ? "—" : u.stock + n}
                </span>
              </div>
            );
          })}
        </div>

        {error && <p className="text-destructive text-[13px]">{error}</p>}
      </div>

      <SheetFooter className="border-t">
        <Button
          type="button"
          onClick={apply}
          disabled={busy || lines.length === 0 || invalid || blocked}
        >
          {busy
            ? "Applying…"
            : `Apply ${lines.length} line${lines.length === 1 ? "" : "s"}`}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {failures.length > 0 ? "Close" : "Cancel"}
        </Button>
      </SheetFooter>
    </>
  );
}
