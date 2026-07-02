"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toMinor } from "@/lib/money";
import { formatApiError } from "@/lib/http/form-error";

type CouponType = "percent" | "fixed";

export function CouponForm() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("percent");
  const [value, setValue] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [appliesTo, setAppliesTo] = useState("all");
  const [active, setActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCode("");
    setType("percent");
    setValue("");
    setMinSubtotal("");
    setUsageLimit("");
    setAppliesTo("all");
    setActive(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setError("Code is required.");
      return;
    }

    const rawValue = Number(value);
    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      setError("Value must be a positive number.");
      return;
    }
    if (type === "percent" && (rawValue < 1 || rawValue > 100)) {
      setError("Percent value must be between 1 and 100.");
      return;
    }

    // For fixed coupons, value is stored as poisha (minor units); for percent
    // it's a 1–100 percentage sent as-is.
    const payloadValue = type === "fixed" ? toMinor(rawValue) : rawValue;

    const body: Record<string, unknown> = {
      code: trimmedCode,
      type,
      value: payloadValue,
      appliesTo,
      active,
    };

    if (minSubtotal.trim() !== "") {
      const minMajor = Number(minSubtotal);
      if (!Number.isFinite(minMajor) || minMajor < 0) {
        setError("Minimum subtotal must be a non-negative number.");
        return;
      }
      body.minSubtotalMinor = toMinor(minMajor);
    }

    if (usageLimit.trim() !== "") {
      const limit = Number(usageLimit);
      if (!Number.isInteger(limit) || limit < 1) {
        setError("Usage limit must be a positive whole number.");
        return;
      }
      body.usageLimit = limit;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        const msg = formatApiError(json, "Failed to create coupon.");
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Coupon created");
      reset();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const valueHint =
    type === "percent"
      ? "Percentage off (1–100)."
      : "Amount off in BDT (Taka).";

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="coupon-code">Code</Label>
          <Input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="WELCOME10"
            autoCapitalize="characters"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="coupon-type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as CouponType)}>
            <SelectTrigger id="coupon-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percent (%)</SelectItem>
              <SelectItem value="fixed">Fixed (BDT)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="coupon-value">Value</Label>
          <Input
            id="coupon-value"
            type="number"
            inputMode="decimal"
            min={0}
            step={type === "percent" ? 1 : 0.01}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "percent" ? "10" : "500"}
          />
          <span className="text-muted-foreground text-xs">{valueHint}</span>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="coupon-min">Minimum subtotal (BDT)</Label>
          <Input
            id="coupon-min"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={minSubtotal}
            onChange={(e) => setMinSubtotal(e.target.value)}
            placeholder="Optional"
          />
          <span className="text-muted-foreground text-xs">
            Leave blank for no minimum.
          </span>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="coupon-scope">Applies to</Label>
          <Select value={appliesTo} onValueChange={setAppliesTo}>
            <SelectTrigger id="coupon-scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All storefronts</SelectItem>
              <SelectItem value="marketplace">Spiber Kart</SelectItem>
              <SelectItem value="instruments">Medtrade</SelectItem>
              <SelectItem value="academy">Academy</SelectItem>
              <SelectItem value="systems">Digihealth</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="coupon-limit">Usage limit</Label>
          <Input
            id="coupon-limit"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="Optional"
          />
          <span className="text-muted-foreground text-xs">
            Leave blank for unlimited.
          </span>
        </div>

        <div className="flex items-center gap-2 self-end pb-2">
          <Switch
            id="coupon-active"
            checked={active}
            onCheckedChange={setActive}
          />
          <Label htmlFor="coupon-active">Active</Label>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive m-0 text-sm">
          {error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Create coupon"}
        </Button>
      </div>
    </form>
  );
}
