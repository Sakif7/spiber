import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

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
import { Coupon } from "@/lib/models/coupon";
import { validateCoupon } from "@/lib/services/coupon.service";

beforeEach(async () => {
  await connectToDatabase();
  await Coupon.deleteMany({});
});

describe("coupon scope", () => {
  it("a marketplace-scoped coupon applies in the marketplace, not instruments", async () => {
    await Coupon.create({
      code: "MKT10",
      type: "percent",
      value: 10,
      appliesTo: "marketplace",
      active: true,
    });
    const inMkt = await validateCoupon(
      "MKT10",
      100000,
      new Date(),
      "marketplace",
    );
    expect(inMkt.ok).toBe(true);
    const inInstr = await validateCoupon(
      "MKT10",
      100000,
      new Date(),
      "instruments",
    );
    expect(inInstr.ok).toBe(false);
    if (!inInstr.ok) expect(inInstr.reason).toBe("scope");
  });

  it("an instruments-scoped coupon does NOT apply in the marketplace", async () => {
    await Coupon.create({
      code: "INST10",
      type: "percent",
      value: 10,
      appliesTo: "instruments",
      active: true,
    });
    const inMkt = await validateCoupon(
      "INST10",
      100000,
      new Date(),
      "marketplace",
    );
    expect(inMkt.ok).toBe(false);
    if (!inMkt.ok) expect(inMkt.reason).toBe("scope");
  });

  it("an `all`-scoped coupon applies everywhere", async () => {
    await Coupon.create({
      code: "ALL10",
      type: "percent",
      value: 10,
      appliesTo: "all",
      active: true,
    });
    expect(
      (await validateCoupon("ALL10", 100000, new Date(), "marketplace")).ok,
    ).toBe(true);
    expect(
      (await validateCoupon("ALL10", 100000, new Date(), "instruments")).ok,
    ).toBe(true);
  });
});
