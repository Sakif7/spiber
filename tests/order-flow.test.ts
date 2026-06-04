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
import { Product } from "@/lib/models/product";
import { Coupon } from "@/lib/models/coupon";
import { Order } from "@/lib/models/order";
import { Cart } from "@/lib/models/cart";
import { InventoryMovement } from "@/lib/models/inventoryMovement";
import { addToCart } from "@/lib/services/cart.service";
import { placeOrder, transitionOrder } from "@/lib/services/order.service";
import { validateCoupon } from "@/lib/services/coupon.service";
import { reserveCouponUsage } from "@/lib/repositories/coupons.repo";
import { revenueSince } from "@/lib/repositories/orders.repo";

const rid = () => Math.random().toString(36).slice(2, 9);

async function seedProduct(stockQty = 5, priceMinor = 100000) {
  await connectToDatabase();
  return Product.create({
    sku: `SKU-${rid()}`,
    name: { en: "Test Device" },
    slug: `test-${rid()}`,
    categoryId: new mongoose.Types.ObjectId(),
    priceMinor,
    stockQty,
    lowStockThreshold: 2,
    status: "active",
    images: [],
    specs: [],
  });
}

const checkout = (idempotencyKey: string) => ({
  email: "buyer@example.com",
  shippingAddress: {
    line1: "1 Road",
    city: "Dhaka",
    district: "Dhaka",
    phone: "01700000000",
  },
  idempotencyKey,
});

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([
    Product.deleteMany({}),
    Cart.deleteMany({}),
    Order.deleteMany({}),
    InventoryMovement.deleteMany({}),
    Coupon.deleteMany({}),
  ]);
});

describe("order flow (integration)", () => {
  it("places an order, decrements stock, and records a sale movement", async () => {
    const p = await seedProduct(5, 100000);
    const owner = { guestId: `g-${rid()}` };
    await addToCart(owner, String(p._id), 2);

    const res = await placeOrder(checkout("key-1"), owner);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.order.status).toBe("pending");
      expect(res.order.totalMinor).toBeGreaterThan(0);
    }

    const after = await Product.findById(p._id).lean();
    expect(after?.stockQty).toBe(3);
    const sales = await InventoryMovement.find({
      productId: p._id,
      type: "sale",
    });
    expect(sales.length).toBe(1);
    expect(sales[0].qtyDelta).toBe(-2);
  });

  it("is idempotent: a repeated key returns the same order and decrements once", async () => {
    const p = await seedProduct(5);
    const owner = { guestId: `g-${rid()}` };
    await addToCart(owner, String(p._id), 1);

    const r1 = await placeOrder(checkout("dup-key"), owner);
    const r2 = await placeOrder(checkout("dup-key"), owner);
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r2.order.orderNumber).toBe(r1.order.orderNumber);

    expect((await Product.findById(p._id).lean())?.stockQty).toBe(4);
    expect(await Order.countDocuments({})).toBe(1);
  });

  it("refuses to oversell and leaves stock unchanged", async () => {
    const p = await seedProduct(1);
    const owner = { guestId: `g-${rid()}` };
    await addToCart(owner, String(p._id), 1);
    await Cart.updateOne(owner, { $set: { "items.0.qty": 5 } });

    const res = await placeOrder(checkout("oversell"), owner);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("out_of_stock");
    expect((await Product.findById(p._id).lean())?.stockQty).toBe(1);
  });

  it("restores stock when an order is cancelled", async () => {
    const p = await seedProduct(5);
    const owner = { guestId: `g-${rid()}` };
    await addToCart(owner, String(p._id), 2);
    const res = await placeOrder(checkout("cancel-key"), owner);
    expect(res.ok).toBe(true);
    expect((await Product.findById(p._id).lean())?.stockQty).toBe(3);

    const order = await Order.findOne({ idempotencyKey: "cancel-key" });
    const t = await transitionOrder(String(order!._id), "cancelled");
    expect(t.ok).toBe(true);
    expect((await Product.findById(p._id).lean())?.stockQty).toBe(5);
    expect(
      await InventoryMovement.countDocuments({
        productId: p._id,
        type: "return",
      }),
    ).toBe(1);
  });

  it("applies a valid percent coupon at checkout", async () => {
    const p = await seedProduct(5, 100000);
    await Coupon.create({
      code: "SAVE10",
      type: "percent",
      value: 10,
      active: true,
    });
    const v = await validateCoupon("save10", 200000);
    expect(v.ok).toBe(true);

    const owner = { guestId: `g-${rid()}` };
    await addToCart(owner, String(p._id), 2); // subtotal 200000
    const res = await placeOrder(
      { ...checkout("coupon-key"), couponCode: "SAVE10" },
      owner,
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.order.discountMinor).toBe(20000);
  });

  it("treats a paid→cancelled order as a refund and excludes it from revenue", async () => {
    const p = await seedProduct(5, 100000);
    const owner = { guestId: `g-${rid()}` };
    await addToCart(owner, String(p._id), 1);
    const placed = await placeOrder(checkout("paid-cancel"), owner);
    expect(placed.ok).toBe(true);
    const id = String(
      (await Order.findOne({ idempotencyKey: "paid-cancel" }))!._id,
    );

    await transitionOrder(id, "paid");
    const dayStart = new Date(Date.now() - 60_000);
    expect((await revenueSince(dayStart)).count).toBe(1); // counted while paid

    const t = await transitionOrder(id, "cancelled");
    expect(t.ok).toBe(true);
    const after = await Order.findById(id).lean();
    expect(after?.payment.status).toBe("refunded"); // reconciled, not "paid"
    expect((await revenueSince(dayStart)).count).toBe(0); // no longer revenue
    expect((await Product.findById(p._id).lean())?.stockQty).toBe(5); // restocked
  });

  it("reserves a coupon at placement and releases it on cancel", async () => {
    const p = await seedProduct(5, 100000);
    await Coupon.create({
      code: "REL10",
      type: "percent",
      value: 10,
      usageLimit: 1,
      active: true,
    });
    const owner = { guestId: `g-${rid()}` };
    await addToCart(owner, String(p._id), 1);
    const placed = await placeOrder(
      { ...checkout("rel-key"), couponCode: "REL10" },
      owner,
    );
    expect(placed.ok).toBe(true);
    expect((await Coupon.findOne({ code: "REL10" }))?.usedCount).toBe(1);

    const id = String(
      (await Order.findOne({ idempotencyKey: "rel-key" }))!._id,
    );
    await transitionOrder(id, "cancelled");
    expect((await Coupon.findOne({ code: "REL10" }))?.usedCount).toBe(0);
  });

  it("enforces the coupon usage limit atomically (no overcommit)", async () => {
    const c = await Coupon.create({
      code: "ONE",
      type: "percent",
      value: 10,
      usageLimit: 1,
      active: true,
    });
    const [a, b] = await Promise.all([
      reserveCouponUsage(String(c._id)),
      reserveCouponUsage(String(c._id)),
    ]);
    expect([a, b].filter(Boolean).length).toBe(1); // exactly one slot granted
    expect((await Coupon.findById(c._id))?.usedCount).toBe(1);
  });
});
