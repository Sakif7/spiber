"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CtaButton } from "@/components/ui/cta-button";
import { toMinor } from "@/lib/money";
import { formatApiError } from "@/lib/http/form-error";

type CouponType = "percent" | "fixed";

const fieldWrap: CSSProperties = { display: "grid", gap: "var(--s-2)" };

const hint: CSSProperties = {
  fontSize: "var(--fs-xs)",
  color: "var(--color-text-muted)",
};

const selectStyle: CSSProperties = {
  height: 36,
  width: "100%",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  padding: "0 var(--s-3)",
  fontSize: "var(--fs-sm)",
  fontFamily: "var(--font-body)",
};

export function CouponForm() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("percent");
  const [value, setValue] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [active, setActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCode("");
    setType("percent");
    setValue("");
    setMinSubtotal("");
    setUsageLimit("");
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
        setError(formatApiError(json, "Failed to create coupon."));
        return;
      }

      reset();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const valueHint =
    type === "percent"
      ? "Percentage off (1–100)."
      : "Amount off in BDT (Taka).";

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: "var(--s-4)" }}
    >
      <div
        style={{
          display: "grid",
          gap: "var(--s-4)",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        <div style={fieldWrap}>
          <Label htmlFor="coupon-code">Code</Label>
          <Input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="WELCOME10"
            autoCapitalize="characters"
          />
        </div>

        <div style={fieldWrap}>
          <Label htmlFor="coupon-type">Type</Label>
          <select
            id="coupon-type"
            value={type}
            onChange={(e) => setType(e.target.value as CouponType)}
            style={selectStyle}
          >
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed (BDT)</option>
          </select>
        </div>

        <div style={fieldWrap}>
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
          <span style={hint}>{valueHint}</span>
        </div>

        <div style={fieldWrap}>
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
          <span style={hint}>Leave blank for no minimum.</span>
        </div>

        <div style={fieldWrap}>
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
          <span style={hint}>Leave blank for unlimited.</span>
        </div>

        <div style={{ ...fieldWrap, alignContent: "end" }}>
          <Label
            htmlFor="coupon-active"
            style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}
          >
            <input
              id="coupon-active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: "var(--color-brand)",
              }}
            />
            Active
          </Label>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: "var(--fs-sm)",
            color: "var(--color-error)",
          }}
        >
          {error}
        </p>
      )}

      <div>
        <CtaButton type="submit" variant="primary">
          {submitting ? "Saving…" : "Create coupon"}
        </CtaButton>
      </div>
    </form>
  );
}
