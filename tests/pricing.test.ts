import { describe, it, expect } from "vitest";
import {
  priceCart,
  type ShippingSettings,
} from "@/lib/services/pricing.service";

const shipping: ShippingSettings = {
  flatFeeMinor: 8000,
  freeThresholdMinor: 500000,
};

describe("priceCart", () => {
  it("sums line totals and adds flat shipping below threshold", () => {
    const t = priceCart([{ priceMinor: 100000, qty: 2 }], null, shipping);
    expect(t.subtotalMinor).toBe(200000);
    expect(t.discountMinor).toBe(0);
    expect(t.shippingMinor).toBe(8000);
    expect(t.taxMinor).toBe(0);
    expect(t.totalMinor).toBe(208000);
  });

  it("waives shipping at/above the free threshold", () => {
    const t = priceCart([{ priceMinor: 500000, qty: 1 }], null, shipping);
    expect(t.shippingMinor).toBe(0);
    expect(t.totalMinor).toBe(500000);
  });

  it("applies a percent coupon (rounded) and recomputes shipping on discounted subtotal", () => {
    const t = priceCart(
      [{ priceMinor: 100000, qty: 6 }], // 600000
      { type: "percent", value: 20 },
      shipping,
    );
    expect(t.discountMinor).toBe(120000); // 20% of 600000
    // discounted = 480000 < 500000 → flat shipping applies
    expect(t.shippingMinor).toBe(8000);
    expect(t.totalMinor).toBe(488000);
  });

  it("applies a fixed coupon, never below zero", () => {
    const t = priceCart(
      [{ priceMinor: 5000, qty: 1 }],
      { type: "fixed", value: 9000 },
      shipping,
    );
    expect(t.discountMinor).toBe(5000); // capped at subtotal
    expect(t.totalMinor).toBe(8000); // 0 + shipping
  });

  it("ignores a coupon below its minimum subtotal", () => {
    const t = priceCart(
      [{ priceMinor: 10000, qty: 1 }],
      { type: "percent", value: 50, minSubtotalMinor: 50000 },
      shipping,
    );
    expect(t.discountMinor).toBe(0);
  });

  it("charges no shipping on an empty cart", () => {
    const t = priceCart([], null, shipping);
    expect(t.totalMinor).toBe(0);
    expect(t.shippingMinor).toBe(0);
  });
});
