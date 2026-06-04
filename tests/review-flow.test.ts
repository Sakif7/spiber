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
import { Review } from "@/lib/models/review";
import { submitReview, moderateReview } from "@/lib/services/review.service";
import type { OrderStatus } from "@/lib/schemas/order";

const rid = () => Math.random().toString(36).slice(2, 9);

async function seedProduct() {
  await connectToDatabase();
  return Product.create({
    sku: `SKU-${rid()}`,
    name: { en: "Blender" },
    slug: `blender-${rid()}`,
    categoryId: new mongoose.Types.ObjectId(),
    storefront: "marketplace",
    priceMinor: 50000,
    stockQty: 10,
    status: "active",
    images: [],
    specs: [],
  });
}

async function seedOrderFor(
  userId: string,
  productId: string,
  status: OrderStatus = "delivered",
) {
  await connectToDatabase();
  return Order.create({
    orderNumber: `SPM-${rid()}`,
    userId: new mongoose.Types.ObjectId(userId),
    email: "buyer@test.com",
    items: [
      {
        productId: new mongoose.Types.ObjectId(productId),
        productSnapshot: {
          name: { en: "Blender" },
          sku: "x",
          priceMinor: 50000,
        },
        qty: 1,
        lineTotalMinor: 50000,
      },
    ],
    subtotalMinor: 50000,
    totalMinor: 50000,
    currency: "BDT",
    status,
    payment: { provider: "manual", status: "paid" },
    shippingAddress: {
      line1: "1",
      city: "Dhaka",
      district: "Dhaka",
      phone: "017",
    },
    storefront: "marketplace",
    idempotencyKey: rid() + rid(),
    timeline: [],
  });
}

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([
    Product.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
  ]);
});

describe("review flow", () => {
  it("marks verifiedPurchase=true when a matching order exists", async () => {
    const p = await seedProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    await seedOrderFor(userId, String(p._id));
    const res = await submitReview(userId, "Karim", {
      productId: String(p._id),
      rating: 5,
      body: "Great",
    });
    expect(res.ok).toBe(true);
    const r = await Review.findOne({ productId: p._id });
    expect(r?.verifiedPurchase).toBe(true);
    expect(r?.status).toBe("pending");
  });

  it("marks verifiedPurchase=false without a matching order", async () => {
    const p = await seedProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    await submitReview(userId, "Rahim", {
      productId: String(p._id),
      rating: 4,
      body: "Good",
    });
    const r = await Review.findOne({ productId: p._id });
    expect(r?.verifiedPurchase).toBe(false);
  });

  it("enforces one review per user per product", async () => {
    const p = await seedProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    expect(
      (
        await submitReview(userId, "A", {
          productId: String(p._id),
          rating: 5,
          body: "x",
        })
      ).ok,
    ).toBe(true);
    const second = await submitReview(userId, "A", {
      productId: String(p._id),
      rating: 3,
      body: "y",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("already_reviewed");
  });

  it("recomputes ratingAvg/ratingCount on approve and excludes rejected", async () => {
    const p = await seedProduct();
    const u1 = new mongoose.Types.ObjectId().toString();
    const u2 = new mongoose.Types.ObjectId().toString();
    await submitReview(u1, "A", {
      productId: String(p._id),
      rating: 4,
      body: "x",
    });
    await submitReview(u2, "B", {
      productId: String(p._id),
      rating: 2,
      body: "y",
    });
    const reviews = await Review.find({ productId: p._id });

    await moderateReview(String(reviews[0]._id), "approved");
    await moderateReview(String(reviews[1]._id), "approved");
    let prod = await Product.findById(p._id).lean();
    expect(prod?.ratingCount).toBe(2);
    expect(prod?.ratingAvg).toBe(3); // (4+2)/2

    // Reject one → excluded from rating
    await moderateReview(String(reviews[1]._id), "rejected");
    prod = await Product.findById(p._id).lean();
    expect(prod?.ratingCount).toBe(1);
    expect(prod?.ratingAvg).toBe(4);
  });
});
