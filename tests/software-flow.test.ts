import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// connect.ts reads MONGODB_URI lazily, so set it before any service connects.
let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  process.env.MONGODB_DB = "test";
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mem?.stop();
});

import { connectToDatabase } from "@/lib/db/connect";
import { SoftwareProduct } from "@/lib/models/softwareProduct";
import { SoftwarePurchase } from "@/lib/models/softwarePurchase";
import { License } from "@/lib/models/license";
import { ProvisioningTask } from "@/lib/models/provisioningTask";
import { AffiliateCommission } from "@/lib/models/affiliateCommission";
import { Coupon } from "@/lib/models/coupon";
import {
  buySoftware,
  transitionPurchase,
  priceSoftware,
} from "@/lib/services/software.service";
import { licenseProvider } from "@/lib/fulfillment/license.provider";
import { externalManualProvider } from "@/lib/fulfillment/external/manual.provider";
import type { DeliveryType } from "@/lib/schemas/systems";

const rid = () => Math.random().toString(36).slice(2, 9);
const uid = () => new mongoose.Types.ObjectId().toString();

async function seedSoftware(
  opts: {
    deliveryType?: DeliveryType;
    pricingModel?: "one_time" | "subscription" | "quote";
    priceMinor?: number;
    status?: "draft" | "active" | "archived";
    assetKey?: string;
    externalApp?: string;
    rateBp?: number;
  } = {},
) {
  await connectToDatabase();
  return SoftwareProduct.create({
    name: { en: "Test App" },
    slug: `app-${rid()}`,
    pricingModel: opts.pricingModel ?? "one_time",
    priceMinor: opts.priceMinor ?? 100000,
    deliveryType: opts.deliveryType ?? "license",
    assetKey: opts.assetKey,
    externalApp: opts.externalApp,
    affiliate: opts.rateBp != null ? { rateBp: opts.rateBp } : undefined,
    status: opts.status ?? "active",
  });
}

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([
    SoftwareProduct.deleteMany({}),
    SoftwarePurchase.deleteMany({}),
    License.deleteMany({}),
    ProvisioningTask.deleteMany({}),
    AffiliateCommission.deleteMany({}),
    Coupon.deleteMany({}),
  ]);
});

describe("priceSoftware (pure)", () => {
  it("applies a percent coupon, capped at subtotal", () => {
    expect(priceSoftware(100000, { type: "percent", value: 10 })).toEqual({
      subtotalMinor: 100000,
      discountMinor: 10000,
      totalMinor: 90000,
    });
  });
  it("applies a fixed coupon and never goes negative", () => {
    expect(priceSoftware(5000, { type: "fixed", value: 9999 })).toEqual({
      subtotalMinor: 5000,
      discountMinor: 5000,
      totalMinor: 0,
    });
  });
});

describe("buySoftware (integration)", () => {
  it("creates a paid product purchase as pending", async () => {
    const p = await seedSoftware({ priceMinor: 150000 });
    const res = await buySoftware({
      softwareProductId: String(p._id),
      userId: uid(),
      email: "u@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.purchase.status).toBe("pending");
      expect(res.purchase.payment.status).toBe("unpaid");
      expect(res.purchase.productSnapshot.priceMinor).toBe(150000);
    }
  });

  it("is idempotent on the idempotency key", async () => {
    const p = await seedSoftware({ priceMinor: 100000 });
    const u = uid();
    const key = `dup-${rid()}`;
    const r1 = await buySoftware({
      softwareProductId: String(p._id),
      userId: u,
      email: "s@example.com",
      idempotencyKey: key,
    });
    const r2 = await buySoftware({
      softwareProductId: String(p._id),
      userId: u,
      email: "s@example.com",
      idempotencyKey: key,
    });
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r2.purchase.purchaseNumber).toBe(r1.purchase.purchaseNumber);
    }
    expect(await SoftwarePurchase.countDocuments({})).toBe(1);
  });

  it("rejects a quote-priced product (inquiry only)", async () => {
    const p = await seedSoftware({
      pricingModel: "quote",
      priceMinor: undefined,
    });
    const res = await buySoftware({
      softwareProductId: String(p._id),
      userId: uid(),
      email: "s@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("not_purchasable");
  });

  it("rejects a non-active product", async () => {
    const p = await seedSoftware({ status: "draft" });
    const res = await buySoftware({
      softwareProductId: String(p._id),
      userId: uid(),
      email: "s@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("not_active");
  });

  it("blocks a second purchase once one is paid", async () => {
    const p = await seedSoftware({ priceMinor: 100000 });
    const u = uid();
    const r1 = await buySoftware({
      softwareProductId: String(p._id),
      userId: u,
      email: "s@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    if (!r1.ok) throw new Error("setup failed");
    const purchase = await SoftwarePurchase.findOne({
      purchaseNumber: r1.purchase.purchaseNumber,
    });
    await transitionPurchase(String(purchase!._id), "paid");

    const r2 = await buySoftware({
      softwareProductId: String(p._id),
      userId: u,
      email: "s@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe("already_owned");
  });
});

describe("fulfillment on mark-paid", () => {
  async function buyAndPay(productId: string) {
    const r = await buySoftware({
      softwareProductId: productId,
      userId: uid(),
      email: "u@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    if (!r.ok) throw new Error("buy failed");
    const purchase = await SoftwarePurchase.findOne({
      purchaseNumber: r.purchase.purchaseNumber,
    });
    const t = await transitionPurchase(String(purchase!._id), "paid");
    return { purchaseId: String(purchase!._id), t };
  }

  it("license delivery issues exactly one active license", async () => {
    const p = await seedSoftware({
      deliveryType: "license",
      priceMinor: 100000,
    });
    const { purchaseId, t } = await buyAndPay(String(p._id));
    expect(t.ok).toBe(true);
    const licenses = await License.find({ purchaseId });
    expect(licenses).toHaveLength(1);
    expect(licenses[0].status).toBe("active");
    expect(licenses[0].key).toMatch(/^SPM-LIC-/);
    const purchase = await SoftwarePurchase.findById(purchaseId).lean();
    expect(purchase?.fulfillment.status).toBe("done");
    expect(String(purchase?.fulfillment.licenseId)).toBe(
      String(licenses[0]._id),
    );
  });

  it("asset delivery produces no license/task/commission", async () => {
    const p = await seedSoftware({
      deliveryType: "asset",
      assetKey: "software/app.zip",
      priceMinor: 100000,
    });
    const { purchaseId } = await buyAndPay(String(p._id));
    expect(await License.countDocuments({ purchaseId })).toBe(0);
    expect(await ProvisioningTask.countDocuments({ purchaseId })).toBe(0);
    expect(await AffiliateCommission.countDocuments({ purchaseId })).toBe(0);
    const purchase = await SoftwarePurchase.findById(purchaseId).lean();
    expect(purchase?.fulfillment.status).toBe("done");
  });

  it("external delivery creates one provisioning task + one commission (15%)", async () => {
    const p = await seedSoftware({
      deliveryType: "external",
      externalApp: "zenhcare",
      priceMinor: 1000000, // 10,000 BDT
      rateBp: 1500, // 15%
    });
    const { purchaseId } = await buyAndPay(String(p._id));

    const tasks = await ProvisioningTask.find({ purchaseId });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("open");
    expect(tasks[0].externalApp).toBe("zenhcare");

    const commissions = await AffiliateCommission.find({ purchaseId });
    expect(commissions).toHaveLength(1);
    expect(commissions[0].amountMinor).toBe(150000); // 10000*0.15 → 1500 BDT
    expect(commissions[0].status).toBe("accrued");
  });

  it("refunding an external purchase voids the commission", async () => {
    const p = await seedSoftware({
      deliveryType: "external",
      externalApp: "zenhcare",
      priceMinor: 1000000,
      rateBp: 1000,
    });
    const { purchaseId } = await buyAndPay(String(p._id));
    await transitionPurchase(purchaseId, "refunded");
    const commission = await AffiliateCommission.findOne({ purchaseId });
    expect(commission?.status).toBe("void");
  });

  it("rejects an invalid transition (pending → refunded)", async () => {
    const p = await seedSoftware({ priceMinor: 100000 });
    const r = await buySoftware({
      softwareProductId: String(p._id),
      userId: uid(),
      email: "u@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    if (!r.ok) throw new Error("buy failed");
    const purchase = await SoftwarePurchase.findOne({
      purchaseNumber: r.purchase.purchaseNumber,
    });
    const t = await transitionPurchase(String(purchase!._id), "refunded");
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.code).toBe("invalid_transition");
  });
});

describe("fulfillment providers are idempotent", () => {
  it("license provider returns the same license on a repeat call", async () => {
    const ctx = {
      purchaseId: uid(),
      userId: uid(),
      email: "u@example.com",
      softwareProductId: uid(),
      snapshot: {
        name: { en: "App" },
        slug: "app",
        priceMinor: 100000,
        deliveryType: "license" as DeliveryType,
      },
      chargedMinor: 100000,
    };
    const a = await licenseProvider.fulfill(ctx);
    const b = await licenseProvider.fulfill(ctx);
    expect(a.licenseId).toBe(b.licenseId);
    expect(await License.countDocuments({ purchaseId: ctx.purchaseId })).toBe(
      1,
    );
  });

  it("external provider returns the same task/commission on a repeat call", async () => {
    const ctx = {
      purchaseId: uid(),
      userId: uid(),
      email: "u@example.com",
      softwareProductId: uid(),
      snapshot: {
        name: { en: "ZenHcare" },
        slug: "zenhcare",
        priceMinor: 1000000,
        deliveryType: "external" as DeliveryType,
        externalApp: "zenhcare",
        affiliate: { rateBp: 2000 },
      },
      chargedMinor: 1000000,
    };
    const a = await externalManualProvider.fulfill(ctx);
    const b = await externalManualProvider.fulfill(ctx);
    expect(a.provisioningTaskId).toBe(b.provisioningTaskId);
    expect(a.commissionId).toBe(b.commissionId);
    expect(
      await ProvisioningTask.countDocuments({ purchaseId: ctx.purchaseId }),
    ).toBe(1);
    expect(
      await AffiliateCommission.countDocuments({ purchaseId: ctx.purchaseId }),
    ).toBe(1);
  });

  it("accrues commission on the amount charged, not the list price", async () => {
    const ctx = {
      purchaseId: uid(),
      userId: uid(),
      email: "u@example.com",
      softwareProductId: uid(),
      snapshot: {
        name: { en: "ZenHcare" },
        slug: "zenhcare",
        priceMinor: 1000000, // list price
        deliveryType: "external" as DeliveryType,
        externalApp: "zenhcare",
        affiliate: { rateBp: 1500 }, // 15%
      },
      chargedMinor: 800000, // 20% coupon was applied
    };
    await externalManualProvider.fulfill(ctx);
    const commission = await AffiliateCommission.findOne({
      purchaseId: ctx.purchaseId,
    });
    // 15% of the CHARGED 800000 = 120000, not 15% of list 1000000 = 150000.
    expect(commission?.amountMinor).toBe(120000);
    expect(commission?.basePriceMinor).toBe(800000);
  });
});
