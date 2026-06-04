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
import { Course } from "@/lib/models/course";
import { Enrollment } from "@/lib/models/enrollment";
import { Coupon } from "@/lib/models/coupon";
import {
  enrollCourse,
  transitionEnrollment,
  markLessonComplete,
  submitQuiz,
  priceEnrollment,
} from "@/lib/services/enrollment.service";

const rid = () => Math.random().toString(36).slice(2, 9);
const uid = () => new mongoose.Types.ObjectId().toString();

async function seedCourse(
  opts: {
    priceMinor?: number;
    status?: "draft" | "published" | "archived";
  } = {},
) {
  await connectToDatabase();
  return Course.create({
    title: { en: "Test Course" },
    slug: `course-${rid()}`,
    level: "beginner",
    priceMinor: opts.priceMinor ?? 0,
    status: opts.status ?? "published",
    modules: [
      {
        id: "M1",
        title: { en: "Module 1" },
        order: 0,
        lessons: [
          {
            id: "L1",
            title: { en: "Intro" },
            order: 0,
            type: "video",
            resources: [],
            isFreePreview: true,
          },
          {
            id: "L2",
            title: { en: "Quiz" },
            order: 1,
            type: "quiz",
            resources: [],
            isFreePreview: false,
            quiz: {
              passPercent: 50,
              questions: [
                {
                  id: "Q1",
                  prompt: { en: "1?" },
                  options: [
                    { id: "a", text: { en: "A" } },
                    { id: "b", text: { en: "B" } },
                  ],
                  correctOptionId: "a",
                },
                {
                  id: "Q2",
                  prompt: { en: "2?" },
                  options: [
                    { id: "a", text: { en: "A" } },
                    { id: "b", text: { en: "B" } },
                  ],
                  correctOptionId: "b",
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([
    Course.deleteMany({}),
    Enrollment.deleteMany({}),
    Coupon.deleteMany({}),
  ]);
});

describe("priceEnrollment (pure)", () => {
  it("applies a percent coupon, capped at subtotal", () => {
    expect(priceEnrollment(100000, { type: "percent", value: 10 })).toEqual({
      subtotalMinor: 100000,
      discountMinor: 10000,
      totalMinor: 90000,
    });
  });
  it("applies a fixed coupon and never goes negative", () => {
    expect(priceEnrollment(5000, { type: "fixed", value: 9999 })).toEqual({
      subtotalMinor: 5000,
      discountMinor: 5000,
      totalMinor: 0,
    });
  });
  it("ignores a coupon below its min subtotal", () => {
    const t = priceEnrollment(1000, {
      type: "percent",
      value: 50,
      minSubtotalMinor: 5000,
    });
    expect(t.discountMinor).toBe(0);
    expect(t.totalMinor).toBe(1000);
  });
});

describe("enrollment flow (integration)", () => {
  it("enrolls a free course as active immediately", async () => {
    const c = await seedCourse({ priceMinor: 0 });
    const res = await enrollCourse({
      courseId: String(c._id),
      userId: uid(),
      email: "stu@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.enrollment.status).toBe("active");
      expect(res.enrollment.payment.status).toBe("paid");
      expect(res.enrollment.totalMinor).toBe(0);
    }
  });

  it("creates a paid course enrollment as pending, then admin activates it", async () => {
    const c = await seedCourse({ priceMinor: 150000 });
    const res = await enrollCourse({
      courseId: String(c._id),
      userId: uid(),
      email: "stu@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.enrollment.status).toBe("pending");
    expect(res.enrollment.payment.status).toBe("unpaid");

    const e = await Enrollment.findOne({
      idempotencyKey: res.enrollment.idempotencyKey,
    });
    const t = await transitionEnrollment(String(e!._id), "active");
    expect(t.ok).toBe(true);
    if (t.ok) {
      expect(t.enrollment.status).toBe("active");
      expect(t.enrollment.payment.status).toBe("paid");
      expect(t.enrollment.payment.paidAt).toBeTruthy();
    }
  });

  it("is idempotent on the idempotency key", async () => {
    const c = await seedCourse({ priceMinor: 100000 });
    const u = uid();
    const key = `dup-${rid()}`;
    const r1 = await enrollCourse({
      courseId: String(c._id),
      userId: u,
      email: "s@example.com",
      idempotencyKey: key,
    });
    const r2 = await enrollCourse({
      courseId: String(c._id),
      userId: u,
      email: "s@example.com",
      idempotencyKey: key,
    });
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r2.enrollment.enrollmentNumber).toBe(
        r1.enrollment.enrollmentNumber,
      );
    }
    expect(await Enrollment.countDocuments({})).toBe(1);
  });

  it("rejects a second active enrollment in the same course", async () => {
    const c = await seedCourse({ priceMinor: 0 });
    const u = uid();
    await enrollCourse({
      courseId: String(c._id),
      userId: u,
      email: "s@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    const again = await enrollCourse({
      courseId: String(c._id),
      userId: u,
      email: "s@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.code).toBe("already_enrolled");
  });

  it("prevents duplicate active enrollments under a concurrent double-enroll", async () => {
    const c = await seedCourse({ priceMinor: 0 });
    const u = uid();
    // Two simultaneous enrolls with DIFFERENT idempotency keys (double-click).
    const [a, b] = await Promise.all([
      enrollCourse({
        courseId: String(c._id),
        userId: u,
        email: "s@example.com",
        idempotencyKey: `k-${rid()}`,
      }),
      enrollCourse({
        courseId: String(c._id),
        userId: u,
        email: "s@example.com",
        idempotencyKey: `k-${rid()}`,
      }),
    ]);
    // At least one succeeds; the DB partial-unique index prevents a 2nd live row.
    expect([a, b].some((r) => r.ok)).toBe(true);
    expect(
      await Enrollment.countDocuments({
        userId: u,
        courseId: c._id,
        status: { $in: ["pending", "active"] },
      }),
    ).toBe(1);
  });

  it("tracks progress and issues a certificate on 100% completion", async () => {
    const c = await seedCourse({ priceMinor: 0 });
    const u = uid();
    await enrollCourse({
      courseId: String(c._id),
      userId: u,
      email: "s@example.com",
      idempotencyKey: `k-${rid()}`,
    });

    const p1 = await markLessonComplete(u, String(c._id), "L1");
    expect(p1.ok).toBe(true);
    if (p1.ok) {
      expect(p1.totalLessons).toBe(2);
      expect(p1.completedLessons).toBe(1);
      expect(p1.courseCompleted).toBe(false);
    }

    // Passing the quiz completes L2 → course complete.
    const q = await submitQuiz(u, String(c._id), "L2", [
      { questionId: "Q1", optionId: "a" },
      { questionId: "Q2", optionId: "b" },
    ]);
    expect(q.ok).toBe(true);
    if (q.ok) {
      expect(q.scorePercent).toBe(100);
      expect(q.passed).toBe(true);
    }

    const e = await Enrollment.findOne({ userId: u, courseId: c._id }).lean();
    expect(e?.completedAt).toBeTruthy();
    expect(e?.certificateId).toBeTruthy();
  });

  it("fails a quiz below the pass threshold without completing the lesson", async () => {
    const c = await seedCourse({ priceMinor: 0 });
    const u = uid();
    await enrollCourse({
      courseId: String(c._id),
      userId: u,
      email: "s@example.com",
      idempotencyKey: `k-${rid()}`,
    });
    const q = await submitQuiz(u, String(c._id), "L2", [
      { questionId: "Q1", optionId: "b" },
      { questionId: "Q2", optionId: "a" },
    ]);
    expect(q.ok).toBe(true);
    if (q.ok) {
      expect(q.scorePercent).toBe(0);
      expect(q.passed).toBe(false);
    }
    const e = await Enrollment.findOne({ userId: u, courseId: c._id }).lean();
    expect(e?.progress.some((p) => p.lessonId === "L2")).toBe(false);
  });

  it("applies an academy-scoped coupon but ignores an instruments-scoped one", async () => {
    const c = await seedCourse({ priceMinor: 100000 });
    await Coupon.create({
      code: "EDU10",
      type: "percent",
      value: 10,
      appliesTo: "academy",
      active: true,
    });
    await Coupon.create({
      code: "SHOPONLY",
      type: "percent",
      value: 50,
      appliesTo: "instruments",
      active: true,
    });

    const withEdu = await enrollCourse({
      courseId: String(c._id),
      userId: uid(),
      email: "a@example.com",
      idempotencyKey: `k-${rid()}`,
      couponCode: "EDU10",
    });
    expect(withEdu.ok).toBe(true);
    if (withEdu.ok) expect(withEdu.enrollment.discountMinor).toBe(10000);

    const withShop = await enrollCourse({
      courseId: String(c._id),
      userId: uid(),
      email: "b@example.com",
      idempotencyKey: `k-${rid()}`,
      couponCode: "SHOPONLY",
    });
    expect(withShop.ok).toBe(true);
    if (withShop.ok) expect(withShop.enrollment.discountMinor).toBe(0);
  });
});
