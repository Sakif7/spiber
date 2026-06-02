import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Course, type ICourse } from "@/lib/models/course";
import { Enrollment, type IEnrollment } from "@/lib/models/enrollment";
import { flattenLessons, findLesson } from "@/lib/repositories/courses.repo";
import {
  getEnrollmentByIdempotencyKey,
  getActiveEnrollment,
  getEnrollmentById,
  createEnrollment,
} from "@/lib/repositories/enrollments.repo";
import { incrementCouponUsage } from "@/lib/repositories/coupons.repo";
import { validateCoupon } from "./coupon.service";
import { getPaymentProvider } from "@/lib/payments";
import { getMailer } from "@/lib/mailer";
import { siteConfig } from "@/lib/site-config";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import { logger } from "@/lib/log";
import {
  ENROLLMENT_TRANSITIONS,
  type EnrollmentStatus,
} from "@/lib/schemas/enrollment";

function genEnrollmentNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `SPM-EDU-${ts}-${rand}`;
}

function genCertificateId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1679616)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `CERT-${ts}-${rand}`;
}

// ---- Pricing (pure, unit-tested) ----

export type EnrollmentCoupon = {
  type: "percent" | "fixed";
  value: number;
  minSubtotalMinor?: number;
} | null;

export type EnrollmentTotals = {
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
};

/** Single-item course pricing: price − coupon discount (no shipping/tax). */
export function priceEnrollment(
  priceMinor: number,
  coupon: EnrollmentCoupon,
): EnrollmentTotals {
  const subtotalMinor = Math.max(0, Math.round(priceMinor));
  let discountMinor = 0;
  if (
    coupon &&
    (coupon.minSubtotalMinor == null ||
      subtotalMinor >= coupon.minSubtotalMinor)
  ) {
    discountMinor =
      coupon.type === "percent"
        ? Math.round((subtotalMinor * coupon.value) / 100)
        : Math.round(coupon.value);
    discountMinor = Math.min(discountMinor, subtotalMinor);
  }
  return {
    subtotalMinor,
    discountMinor,
    totalMinor: subtotalMinor - discountMinor,
  };
}

// ---- Enroll ----

export type EnrollResult =
  | { ok: true; enrollment: IEnrollment; alreadyActive?: boolean }
  | {
      ok: false;
      code: "course_not_found" | "not_published" | "already_enrolled";
    };

/**
 * Enroll a logged-in user in a course. Idempotent on `idempotencyKey`. Free
 * courses (total 0) activate immediately; paid courses start `pending` until an
 * admin marks them paid. No cart — a course is a single-line purchase.
 */
export async function enrollCourse(args: {
  courseId: string;
  userId: string;
  email: string;
  idempotencyKey: string;
  couponCode?: string;
  /** Admin grant: skip payment and activate immediately. */
  grant?: boolean;
}): Promise<EnrollResult> {
  await connectToDatabase();

  const existingKey = await getEnrollmentByIdempotencyKey(args.idempotencyKey);
  if (existingKey) return { ok: true, enrollment: existingKey.toObject() };

  const course = await Course.findOne({
    _id: args.courseId,
    deletedAt: null,
  }).exec();
  if (!course) return { ok: false, code: "course_not_found" };
  if (course.status !== "published" && !args.grant) {
    return { ok: false, code: "not_published" };
  }

  const existing = await getActiveEnrollment(args.userId, args.courseId);
  if (existing) {
    if (existing.status === "active") {
      return { ok: false, code: "already_enrolled" };
    }
    // A pending enrollment exists — resume it rather than duplicating.
    return { ok: true, enrollment: existing.toObject() };
  }

  // Price (coupons scoped to academy; ignored for admin grants).
  let coupon: EnrollmentCoupon = null;
  let couponId: string | undefined;
  let couponCode: string | undefined;
  if (args.couponCode && !args.grant) {
    const v = await validateCoupon(
      args.couponCode,
      course.priceMinor,
      new Date(),
      "academy",
    );
    if (v.ok) {
      coupon = {
        type: v.coupon.type,
        value: v.coupon.value,
        minSubtotalMinor: v.coupon.minSubtotalMinor,
      };
      couponId = v.coupon.id;
      couponCode = v.coupon.code;
    }
  }

  const totals = args.grant
    ? {
        subtotalMinor: course.priceMinor,
        discountMinor: course.priceMinor,
        totalMinor: 0,
      }
    : priceEnrollment(course.priceMinor, coupon);

  const free = totals.totalMinor <= 0;
  const now = new Date();
  const status: EnrollmentStatus = free || args.grant ? "active" : "pending";

  let enrollment;
  try {
    enrollment = await createEnrollment({
      enrollmentNumber: genEnrollmentNumber(),
      userId: new mongoose.Types.ObjectId(args.userId),
      courseId: course._id,
      email: args.email,
      status,
      payment: {
        provider: getPaymentProvider().name,
        status: free || args.grant ? "paid" : "unpaid",
        paidAt: free || args.grant ? now : null,
      },
      subtotalMinor: totals.subtotalMinor,
      discountMinor: totals.discountMinor,
      totalMinor: totals.totalMinor,
      currency: "BDT",
      couponCode,
      idempotencyKey: args.idempotencyKey,
      progress: [],
      quizScores: [],
      timeline: [
        {
          status,
          at: now,
          note: args.grant
            ? "Enrolled by admin"
            : free
              ? "Enrolled (free)"
              : "Enrollment created",
        },
      ],
    } as Partial<IEnrollment>);
  } catch (err: unknown) {
    if (isDuplicateKey(err)) {
      const dup = await getEnrollmentByIdempotencyKey(args.idempotencyKey);
      if (dup) return { ok: true, enrollment: dup.toObject() };
    }
    throw err;
  }

  if (couponId) await incrementCouponUsage(couponId).catch(() => {});
  await sendEnrollmentEmail(
    enrollment.toObject(),
    localize(course.title, "en"),
    status === "active" ? "active" : "pending",
  ).catch((e) => logger.warn("enrollment email failed", e));

  return { ok: true, enrollment: enrollment.toObject() };
}

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

// ---- Lifecycle transitions ----

export type EnrollmentTransitionResult =
  | { ok: true; enrollment: IEnrollment }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionEnrollment(
  enrollmentId: string,
  to: EnrollmentStatus,
  opts: { note?: string } = {},
): Promise<EnrollmentTransitionResult> {
  await connectToDatabase();
  const enrollment = await getEnrollmentById(enrollmentId);
  if (!enrollment) return { ok: false, code: "not_found" };
  if (!ENROLLMENT_TRANSITIONS[enrollment.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }

  const now = new Date();
  // Activating a pending (paid) enrollment confirms payment + grants access.
  if (to === "active") {
    enrollment.payment.status = "paid";
    enrollment.payment.paidAt = now;
  }
  if (to === "refunded") enrollment.payment.status = "refunded";

  enrollment.status = to;
  enrollment.timeline.push({ status: to, at: now, note: opts.note });
  await enrollment.save();

  if (to === "active") {
    const course = await Course.findById(enrollment.courseId)
      .select("title")
      .lean()
      .exec();
    await sendEnrollmentEmail(
      enrollment.toObject(),
      course ? localize(course.title, "en") : "your course",
      "active",
    ).catch((e) => logger.warn("enrollment email failed", e));
  }
  return { ok: true, enrollment: enrollment.toObject() };
}

// ---- Progress + completion ----

export type ProgressResult =
  | {
      ok: true;
      completedLessons: number;
      totalLessons: number;
      courseCompleted: boolean;
      certificateId?: string | null;
    }
  | { ok: false; code: "not_enrolled" | "lesson_not_found" };

/** Mark a lesson complete for the student's active enrollment. */
export async function markLessonComplete(
  userId: string,
  courseId: string,
  lessonId: string,
): Promise<ProgressResult> {
  await connectToDatabase();
  const enrollment = await Enrollment.findOne({
    userId,
    courseId,
    status: "active",
  }).exec();
  if (!enrollment) return { ok: false, code: "not_enrolled" };

  const course = await Course.findById(courseId)
    .select("modules")
    .lean()
    .exec();
  if (!course || !findLesson(course, lessonId)) {
    return { ok: false, code: "lesson_not_found" };
  }

  return recordCompletion(enrollment, course, lessonId);
}

/** Shared progress-recording used by markLessonComplete + submitQuiz (on pass). */
async function recordCompletion(
  enrollment: mongoose.HydratedDocument<IEnrollment>,
  course: Pick<ICourse, "modules">,
  lessonId: string,
): Promise<ProgressResult> {
  const now = new Date();
  if (!enrollment.progress.some((p) => p.lessonId === lessonId)) {
    enrollment.progress.push({ lessonId, completedAt: now });
  }
  enrollment.lastLessonId = lessonId;

  const allLessons = flattenLessons(course);
  const totalLessons = allLessons.length;
  const validIds = new Set(allLessons.map((l) => l.id));
  const completedLessons = enrollment.progress.filter((p) =>
    validIds.has(p.lessonId),
  ).length;

  let courseCompleted = false;
  if (
    totalLessons > 0 &&
    completedLessons >= totalLessons &&
    !enrollment.completedAt
  ) {
    enrollment.completedAt = now;
    enrollment.certificateId = genCertificateId();
    courseCompleted = true;
  }
  await enrollment.save();

  if (courseCompleted) {
    const full = await Course.findById(enrollment.courseId)
      .select("title")
      .lean()
      .exec();
    await sendCompletionEmail(
      enrollment.toObject(),
      full ? localize(full.title, "en") : "your course",
    ).catch((e) => logger.warn("completion email failed", e));
  }

  return {
    ok: true,
    completedLessons,
    totalLessons,
    courseCompleted,
    certificateId: enrollment.certificateId,
  };
}

// ---- Quiz ----

export type QuizResult =
  | {
      ok: true;
      scorePercent: number;
      passed: boolean;
      total: number;
      correct: number;
      courseCompleted: boolean;
      certificateId?: string | null;
    }
  | { ok: false; code: "not_enrolled" | "lesson_not_found" | "not_a_quiz" };

export async function submitQuiz(
  userId: string,
  courseId: string,
  lessonId: string,
  answers: { questionId: string; optionId: string }[],
): Promise<QuizResult> {
  await connectToDatabase();
  const enrollment = await Enrollment.findOne({
    userId,
    courseId,
    status: "active",
  }).exec();
  if (!enrollment) return { ok: false, code: "not_enrolled" };

  const course = await Course.findById(courseId)
    .select("modules")
    .lean()
    .exec();
  const lesson = course ? findLesson(course, lessonId) : null;
  if (!course || !lesson) return { ok: false, code: "lesson_not_found" };
  if (lesson.type !== "quiz" || !lesson.quiz) {
    return { ok: false, code: "not_a_quiz" };
  }

  const answerMap = new Map(answers.map((a) => [a.questionId, a.optionId]));
  const total = lesson.quiz.questions.length;
  let correct = 0;
  for (const q of lesson.quiz.questions) {
    if (answerMap.get(q.id) === q.correctOptionId) correct += 1;
  }
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = scorePercent >= (lesson.quiz.passPercent ?? 70);
  const now = new Date();

  enrollment.quizScores.push({
    lessonId,
    scorePercent,
    passed,
    attemptedAt: now,
  });
  await enrollment.save();

  let courseCompleted = false;
  let certificateId: string | null | undefined;
  if (passed) {
    // Passing the quiz also completes the lesson (and may complete the course).
    const rec = await recordCompletion(enrollment, course, lessonId).catch(
      (e) => {
        logger.warn("quiz completion record failed", e);
        return null;
      },
    );
    if (rec && rec.ok) {
      courseCompleted = rec.courseCompleted;
      certificateId = rec.certificateId;
    }
  }

  return {
    ok: true,
    scorePercent,
    passed,
    total,
    correct,
    courseCompleted,
    certificateId,
  };
}

// ---- Emails ----

async function sendEnrollmentEmail(
  e: IEnrollment,
  courseTitle: string,
  event: "pending" | "active",
) {
  const subject =
    event === "active"
      ? `You're enrolled: ${courseTitle}`
      : `Enrollment received: ${courseTitle}`;
  const bodyLine =
    event === "active"
      ? `Your enrollment in "${courseTitle}" is active. You can start learning now.`
      : `We received your enrollment in "${courseTitle}". Payment is arranged offline; your access opens once it's confirmed. Total due: ${formatBDT(e.totalMinor)}.`;
  await getMailer().send({
    to: e.email,
    subject,
    text: `${subject}\n\n${bodyLine}\n\nReference: ${e.enrollmentNumber}\n\n${siteConfig.brand}`,
    html: `<p>${bodyLine}</p><p>Reference: <strong>${e.enrollmentNumber}</strong></p><p>${siteConfig.brand}</p>`,
  });
}

async function sendCompletionEmail(e: IEnrollment, courseTitle: string) {
  const subject = `Course completed: ${courseTitle}`;
  const body = `Congratulations on completing "${courseTitle}"! Your certificate (${e.certificateId}) is available in your dashboard.`;
  await getMailer().send({
    to: e.email,
    subject,
    text: `${subject}\n\n${body}\n\n${siteConfig.brand}`,
    html: `<p>${body}</p><p>${siteConfig.brand}</p>`,
  });
}
