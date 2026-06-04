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
import { Quotation } from "@/lib/models/quotation";
import {
  createQuotation,
  transitionQuotation,
  setQuote,
} from "@/lib/services/quotation.service";
import { listQuotationsByRequester } from "@/lib/repositories/quotations.repo";

const rid = () => Math.random().toString(36).slice(2, 9);

async function seedInstrumentProduct() {
  await connectToDatabase();
  return Product.create({
    sku: `SKU-${rid()}`,
    name: { en: "ECG Machine" },
    slug: `ecg-${rid()}`,
    categoryId: new mongoose.Types.ObjectId(),
    storefront: "instruments",
    priceMinor: null,
    status: "active",
    images: [],
    specs: [],
  });
}

const contact = {
  name: "Dr. Karim",
  email: "karim@hospital.test",
  organization: "City Hospital",
};
const delivery = { district: "Dhaka", city: "Dhaka" };

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([Product.deleteMany({}), Quotation.deleteMany({})]);
});

describe("quotation flow", () => {
  it("creates a guest quotation with item snapshots + SPM-RFQ number", async () => {
    const p = await seedInstrumentProduct();
    const res = await createQuotation({
      contact,
      items: [{ productId: String(p._id), quantity: 3 }],
      deliveryLocation: delivery,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.quotation.quotationNumber).toMatch(/^SPM-RFQ-/);
      expect(res.quotation.status).toBe("new");
      expect(res.quotation.items[0].productSnapshot.name.en).toBe(
        "ECG Machine",
      );
      expect(res.quotation.items[0].quantity).toBe(3);
      expect(res.quotation.requesterId ?? null).toBeNull();
    }
  });

  it("ties a signed-in quotation to the requester and lists it", async () => {
    const p = await seedInstrumentProduct();
    const userId = new mongoose.Types.ObjectId().toString();
    const res = await createQuotation(
      {
        contact,
        items: [{ productId: String(p._id), quantity: 1 }],
        deliveryLocation: delivery,
      },
      userId,
    );
    expect(res.ok).toBe(true);
    const mine = await listQuotationsByRequester(userId);
    expect(mine.length).toBe(1);
  });

  it("rejects an unknown product", async () => {
    const res = await createQuotation({
      contact,
      items: [
        { productId: new mongoose.Types.ObjectId().toString(), quantity: 1 },
      ],
      deliveryLocation: delivery,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("product_unavailable");
  });

  it("follows the status machine and rejects invalid transitions", async () => {
    const p = await seedInstrumentProduct();
    const created = await createQuotation({
      contact,
      items: [{ productId: String(p._id), quantity: 1 }],
      deliveryLocation: delivery,
    });
    if (!created.ok) throw new Error("setup");
    const id = String(
      (await Quotation.findOne({
        quotationNumber: created.quotation.quotationNumber,
      }))!._id,
    );

    // new -> won is NOT allowed
    const bad = await transitionQuotation(id, "won");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe("invalid_transition");

    // new -> quoted -> negotiating -> won
    expect((await transitionQuotation(id, "quoted")).ok).toBe(true);
    expect((await transitionQuotation(id, "negotiating")).ok).toBe(true);
    expect((await transitionQuotation(id, "won")).ok).toBe(true);
  });

  it("stores a quote (amount/validUntil) and moves new -> quoted", async () => {
    const p = await seedInstrumentProduct();
    const created = await createQuotation({
      contact,
      items: [{ productId: String(p._id), quantity: 2 }],
      deliveryLocation: delivery,
    });
    if (!created.ok) throw new Error("setup");
    const id = String(
      (await Quotation.findOne({
        quotationNumber: created.quotation.quotationNumber,
      }))!._id,
    );

    const res = await setQuote(id, {
      amountMinor: 250000,
      note: "Includes installation",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.quotation.status).toBe("quoted");
      expect(res.quotation.quote?.amountMinor).toBe(250000);
    }
  });
});
