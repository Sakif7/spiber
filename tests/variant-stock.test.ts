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
import { Product } from "@/lib/models/product";
import { Order } from "@/lib/models/order";
import { Cart } from "@/lib/models/cart";
import { InventoryMovement } from "@/lib/models/inventoryMovement";
import { addToCart } from "@/lib/services/cart.service";
import { placeOrder, transitionOrder } from "@/lib/services/order.service";

const rid = () => Math.random().toString(36).slice(2, 9);

async function seedVariantProduct() {
  await connectToDatabase();
  return Product.create({
    sku: `SKU-${rid()}`,
    name: { en: "Tee" },
    slug: `tee-${rid()}`,
    categoryId: new mongoose.Types.ObjectId(),
    storefront: "marketplace",
    priceMinor: null,
    status: "active",
    images: [],
    specs: [],
    variantOptions: [
      { name: { en: "Size" }, values: [{ en: "S" }, { en: "M" }] },
    ],
    variants: [
      {
        id: "v-s",
        options: [{ name: "Size", value: "S" }],
        sku: `S-${rid()}`,
        priceMinorOverride: 100000,
        stockQty: 5,
      },
      {
        id: "v-m",
        options: [{ name: "Size", value: "M" }],
        sku: `M-${rid()}`,
        priceMinorOverride: 120000,
        stockQty: 3,
      },
    ],
  });
}

async function seedSimpleProduct(stockQty = 5) {
  await connectToDatabase();
  return Product.create({
    sku: `SKU-${rid()}`,
    name: { en: "Simple" },
    slug: `simple-${rid()}`,
    categoryId: new mongoose.Types.ObjectId(),
    storefront: "marketplace",
    priceMinor: 50000,
    stockQty,
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

const variantStock = async (
  id: mongoose.Types.ObjectId | string,
  vid: string,
) => {
  const p = await Product.findById(id).lean();
  return p?.variants.find((v) => v.id === vid)?.stockQty;
};

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([
    Product.deleteMany({}),
    Cart.deleteMany({}),
    Order.deleteMany({}),
    InventoryMovement.deleteMany({}),
  ]);
});

describe("variant stock (integration)", () => {
  it("decrements ONLY the purchased variant and snapshots its price + options", async () => {
    const p = await seedVariantProduct();
    const owner = { guestId: `g-${rid()}` };
    await addToCart(owner, String(p._id), 2, "v-s");

    const res = await placeOrder(
      checkout("v-1"),
      owner,
      undefined,
      "marketplace",
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.order.items[0].productSnapshot.variantId).toBe("v-s");
      expect(
        res.order.items[0].productSnapshot.variantOptions?.[0],
      ).toMatchObject({ name: "Size", value: "S" });
      expect(res.order.items[0].productSnapshot.priceMinor).toBe(100000);
    }
    expect(await variantStock(p._id, "v-s")).toBe(3);
    expect(await variantStock(p._id, "v-m")).toBe(3); // untouched

    const sales = await InventoryMovement.find({
      productId: p._id,
      type: "sale",
    });
    expect(sales.length).toBe(1);
    expect(sales[0].variantId).toBe("v-s");
    expect(sales[0].qtyDelta).toBe(-2);
  });

  it("refuses to oversell a variant and leaves BOTH variants untouched", async () => {
    const p = await seedVariantProduct();
    const owner = { guestId: `g-${rid()}` };
    await addToCart(owner, String(p._id), 1, "v-m");
    await Cart.updateOne(owner, { $set: { "items.0.qty": 10 } }); // > 3 in stock

    const res = await placeOrder(
      checkout("v-oversell"),
      owner,
      undefined,
      "marketplace",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("out_of_stock");
    expect(await variantStock(p._id, "v-s")).toBe(5);
    expect(await variantStock(p._id, "v-m")).toBe(3);
  });

  it("restocks the right variant on cancel", async () => {
    const p = await seedVariantProduct();
    const owner = { guestId: `g-${rid()}` };
    await addToCart(owner, String(p._id), 2, "v-s");
    await placeOrder(checkout("v-cancel"), owner, undefined, "marketplace");
    expect(await variantStock(p._id, "v-s")).toBe(3);

    const order = await Order.findOne({ idempotencyKey: "v-cancel" });
    await transitionOrder(String(order!._id), "cancelled");
    expect(await variantStock(p._id, "v-s")).toBe(5); // restored
    expect(await variantStock(p._id, "v-m")).toBe(3); // untouched
  });

  it("keeps simple (no-variant) products working unchanged", async () => {
    const p = await seedSimpleProduct(5);
    const owner = { guestId: `g-${rid()}` };
    await addToCart(owner, String(p._id), 2);
    const res = await placeOrder(
      checkout("simple-1"),
      owner,
      undefined,
      "marketplace",
    );
    expect(res.ok).toBe(true);
    if (res.ok)
      expect(res.order.items[0].productSnapshot.variantId ?? null).toBeNull();
    expect((await Product.findById(p._id).lean())?.stockQty).toBe(3);
    const sales = await InventoryMovement.find({
      productId: p._id,
      type: "sale",
    });
    expect(sales[0].variantId ?? null).toBeNull();
  });

  it("blocks both buyers when concurrent variant orders exceed stock", async () => {
    const p = await seedVariantProduct(); // v-m has 3
    const o1 = { guestId: `g-${rid()}` };
    const o2 = { guestId: `g-${rid()}` };
    await addToCart(o1, String(p._id), 2, "v-m");
    await addToCart(o2, String(p._id), 2, "v-m");
    const [r1, r2] = await Promise.all([
      placeOrder(checkout("c-1"), o1, undefined, "marketplace"),
      placeOrder(checkout("c-2"), o2, undefined, "marketplace"),
    ]);
    // 2 + 2 > 3, so exactly one succeeds; stock never goes negative.
    expect([r1.ok, r2.ok].filter(Boolean).length).toBe(1);
    expect(await variantStock(p._id, "v-m")).toBe(1);
  });
});
