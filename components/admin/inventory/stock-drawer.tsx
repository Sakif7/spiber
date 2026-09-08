"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { formatApiError } from "@/lib/http/form-error";
import { cn } from "@/lib/cn";
import { calloutClass } from "@/components/admin/ui/tone";
import {
  LEVEL_LABEL,
  MANUAL_TYPES,
  formatDelta,
  unitTitle,
  type HubUnit,
  type ManualType,
} from "./types";

export type DrawerMode = "adjust" | "set";

/**
 * The inline adjust drawer: change one stock unit by a delta ("Adjust by")
 * or to an exact count ("Set to"), with a movement type and a reason. Seller
 * units require an explicit override (the seller is emailed).
 */
export function StockDrawer({
  unit,
  mode,
  open,
  onOpenChange,
}: {
  unit: HubUnit | null;
  mode: DrawerMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        {unit && (
          <DrawerForm
            key={`${unit.key}:${mode}`}
            unit={unit}
            initialMode={mode}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerForm({
  unit,
  initialMode,
  onClose,
}: {
  unit: HubUnit;
  initialMode: DrawerMode;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<DrawerMode>(initialMode);
  const [qty, setQty] = useState("");
  const [type, setType] = useState<ManualType>("adjustment");
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = qty.trim() === "" ? null : Number(qty);
  const valid =
    n !== null && Number.isInteger(n) && (tab === "adjust" ? n !== 0 : n >= 0);
  const after =
    n === null || !Number.isInteger(n)
      ? null
      : tab === "adjust"
        ? unit.stock + n
        : n;
  const needsOverride = Boolean(unit.seller) && !override;
  const belowZero = after !== null && after < 0;

  async function apply() {
    if (!valid || needsOverride || belowZero) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        tab === "adjust"
          ? {
              productId: unit.productId,
              ...(unit.variantId ? { variantId: unit.variantId } : {}),
              qtyDelta: n,
              type,
              reason: reason.trim() || undefined,
              override: unit.seller ? true : undefined,
            }
          : {
              productId: unit.productId,
              ...(unit.variantId ? { variantId: unit.variantId } : {}),
              targetQty: n,
              reason: reason.trim() || undefined,
              override: unit.seller ? true : undefined,
            };
      const res = await fetch(
        tab === "adjust" ? "/api/admin/inventory" : "/api/admin/inventory/set",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(formatApiError(json, "Could not update the stock"));
        return;
      }
      const stockAfter = json.data?.stockAfter;
      toast.success(
        `${unit.sku} updated`,
        stockAfter != null
          ? { description: `Now ${stockAfter} on hand` }
          : undefined,
      );
      router.refresh();
      onClose();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="text-base">{unitTitle(unit)}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs">{unit.sku}</span>
          <span aria-hidden>·</span>
          <span>{unit.storeLabel}</span>
          {unit.seller && (
            <>
              <span aria-hidden>·</span>
              <span>Sold by {unit.seller.name}</span>
            </>
          )}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2.5">
          <div>
            <p className="text-muted-foreground text-admin-2xs font-medium tracking-wide uppercase">
              On hand
            </p>
            <p
              className={cn(
                "font-mono text-2xl font-bold tabular-nums",
                unit.level === "out" && "text-destructive",
                unit.level === "low" && "text-[var(--tone-warning-fg)]",
              )}
            >
              {unit.stock}
            </p>
          </div>
          <div className="text-right">
            {unit.tracked && unit.level ? (
              <StatusBadge
                tone={
                  unit.level === "out"
                    ? "danger"
                    : unit.level === "low"
                      ? "warning"
                      : "success"
                }
              >
                {LEVEL_LABEL[unit.level]}
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Not tracked</StatusBadge>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              Low at {unit.threshold}
            </p>
          </div>
        </div>

        {unit.seller && (
          <div className={calloutClass("warning")}>
            <p className="font-medium">Seller-managed listing</p>
            <p className="text-muted-foreground mt-0.5">
              {unit.seller.name} manages this stock in the seller portal.
              Changing it here overrides their balance and emails them.
            </p>
            <label className="mt-2 flex items-center gap-2">
              <Checkbox
                checked={override}
                onCheckedChange={(v) => setOverride(v === true)}
              />
              Override and notify the seller
            </label>
          </div>
        )}

        {!unit.tracked && (
          <p className="text-muted-foreground">
            This unit is not tracked (quotation-only), so it never raises
            low-stock alerts. Changes are still recorded in the ledger.
          </p>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as DrawerMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="adjust">Adjust by</TabsTrigger>
            <TabsTrigger value="set">Set to</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="stock-qty">
              {tab === "adjust" ? "Change (+ receive / − remove)" : "New count"}
            </Label>
            <Input
              id="stock-qty"
              type="number"
              inputMode="numeric"
              step={1}
              autoFocus
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={tab === "adjust" ? "e.g. 24 or -3" : "e.g. 120"}
              onKeyDown={(e) => {
                if (e.key === "Enter") void apply();
              }}
            />
            {after !== null && (
              <p
                className={cn(
                  "text-xs tabular-nums",
                  belowZero ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {belowZero
                  ? `That would take the balance below zero (${unit.stock} on hand).`
                  : `${unit.stock} → ${after}${
                      tab === "set"
                        ? ` (${formatDelta(after - unit.stock)})`
                        : ""
                    }`}
              </p>
            )}
          </div>

          {tab === "adjust" && (
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
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="stock-reason">Reason (optional)</Label>
            <Input
              id="stock-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                tab === "adjust" ? "e.g. PO 4471 delivered" : "e.g. Stock count"
              }
            />
          </div>
        </div>

        {error && <p className="text-destructive">{error}</p>}
      </div>

      <SheetFooter className="border-t">
        <Button
          type="button"
          onClick={apply}
          disabled={busy || !valid || needsOverride || belowZero}
        >
          {busy ? "Applying…" : tab === "adjust" ? "Apply change" : "Set stock"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </SheetFooter>
    </>
  );
}
