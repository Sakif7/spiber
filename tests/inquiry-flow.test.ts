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
import { Inquiry } from "@/lib/models/inquiry";
import {
  createInquiry,
  transitionInquiry,
} from "@/lib/services/inquiry.service";
import {
  addInquiryNote,
  setInquiryAssignee,
} from "@/lib/repositories/inquiries.repo";

const rid = () => Math.random().toString(36).slice(2, 9);
const uid = () => new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await connectToDatabase();
  await Inquiry.deleteMany({});
});

function input(extra: Record<string, unknown> = {}) {
  return {
    division: "systems" as const,
    name: "Asha",
    email: `lead-${rid()}@example.com`,
    message: "We need a custom hospital dashboard.",
    ...extra,
  };
}

describe("inquiry pipeline", () => {
  it("creates a new inquiry with a reference number", async () => {
    const inq = await createInquiry(input({ subject: "Dashboard" }));
    expect(inq.status).toBe("new");
    expect(inq.division).toBe("systems");
    expect(inq.inquiryNumber).toMatch(/^SPM-INQ-/);
  });

  it("follows the allowed transition path and records a note", async () => {
    const inq = await createInquiry(input());
    const doc = await Inquiry.findOne({ inquiryNumber: inq.inquiryNumber });
    const actor = uid();

    const t1 = await transitionInquiry(String(doc!._id), "qualifying", {
      note: "Reached out",
      actorId: actor,
    });
    expect(t1.ok).toBe(true);
    if (t1.ok) {
      expect(t1.inquiry.status).toBe("qualifying");
      expect(t1.inquiry.notes).toHaveLength(1);
    }

    const t2 = await transitionInquiry(String(doc!._id), "proposal");
    expect(t2.ok).toBe(true);
    const t3 = await transitionInquiry(String(doc!._id), "won");
    expect(t3.ok && t3.inquiry.status === "won").toBe(true);
  });

  it("rejects an invalid transition (new → won)", async () => {
    const inq = await createInquiry(input());
    const doc = await Inquiry.findOne({ inquiryNumber: inq.inquiryNumber });
    const t = await transitionInquiry(String(doc!._id), "won");
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.code).toBe("invalid_transition");
  });

  it("adds notes and assigns an owner", async () => {
    const inq = await createInquiry(input());
    const doc = await Inquiry.findOne({ inquiryNumber: inq.inquiryNumber });
    const actor = uid();
    const owner = uid();

    await addInquiryNote(String(doc!._id), actor, "Called the client");
    const assigned = await setInquiryAssignee(String(doc!._id), owner);
    expect(String(assigned?.assignedTo)).toBe(owner);
    const fresh = await Inquiry.findById(doc!._id).lean();
    expect(fresh?.notes).toHaveLength(1);
  });
});
