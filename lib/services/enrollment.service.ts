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
import {
  reserveCouponUsage,
  releaseCouponUsage,
  releaseCouponUsageByCode,
} from "@/lib/repositories/coupons.repo";
import { makeId } from "@/lib/ids";
import { markSubjectPaymentsForRefund } from "@/lib/repositories/payment-attempts.repo";
import { onlinePointAvailable } from "./payment-availability";
import { roundingFor } from "@/lib/schemas/payment";
import { validateCoupon } from "./coupon.service";
import { notifyAdmins } from "./notification.service";
import { getMailer } from "@/lib/mailer";
import { renderEmail } from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import { logger } from "@/lib/log";
import {
  ENROLLMENT_TRANSITIONS,
  type EnrollmentStatus,
} from "@/lib/schemas/enrollment";

const genEnrollmentNumber = (): string => makeId("SPM-EDU");
// 8 crypto base36 chars: the certificate id is the sole credential for a
// shareable-by-link certificate, so it must be hard to brute-force.
const genCertificateId = (): string => makeId("CERT", 8);

// ---- Pricing (pure, unit-tested) ----

export type EnrollmentCoupon = {
  type: "percent" | "fixed";
  value: number;
  minSubtotalMinor?: number;
} | null;

export type EnrollmentTotals = {
  subtotalMinor: number;
  discountMinor: number;
  /** Poisha dropped so the total is whole taka (0 to −99). */
  roundingMinor: number;
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
  // Whole taka, like every payable total (owner's decision, 2026-10-28).
  const roundingMinor = roundingFor(subtotalMinor - discountMinor);
  return {
    subtotalMinor,
    discountMinor,
    roundingMinor,
    totalMinor: subtotalMinor - discountMinor + roundingMinor,
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

  let totals = args.grant
    ? {
        subtotalMinor: course.priceMinor,
        discountMinor: course.priceMinor,
        roundingMinor: 0,
        totalMinor: 0,
      }
    : priceEnrollment(course.priceMinor, coupon);

  // Atomically claim the coupon's slot before creating the enrollment; if it was
  // exhausted in a race, drop the discount and re-price at full amount.
  let couponReserved = false;
  if (couponId) {
    couponReserved = await reserveCouponUsage(couponId);
    if (!couponReserved) {
      logger.warn(
        `coupon ${couponCode} exhausted at enroll; dropping discount`,
      );
      coupon = null;
      couponId = undefined;
      couponCode = undefined;
      totals = priceEnrollment(course.priceMinor, null);
    }
  }

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
        // Paid offline until online payment reaches this door (PayStation
        // plan, phase 2); asking the gateway here could only fail.
        provider: "manual",
        status: free || args.grant ? "paid" : "unpaid",
        paidAt: free || args.grant ? now : null,
      },
      subtotalMinor: totals.subtotalMinor,
      discountMinor: totals.discountMinor,
      roundingMinor: totals.roundingMinor,
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
      // Concurrent retry (idempotency key) OR concurrent enroll (userId+courseId
      // partial unique index). Return the canonical record and release the slot
      // we just claimed, since the winning request reserved its own.
      if (couponReserved && couponId)
        await releaseCouponUsage(couponId).catch(() => {});
      const dup = await getEnrollmentByIdempotencyKey(args.idempotencyKey);
      if (dup) return { ok: true, enrollment: dup.toObject() };
      const active = await getActiveEnrollment(args.userId, args.courseId);
      if (active) {
        return active.status === "active"
          ? { ok: false, code: "already_enrolled" }
          : { ok: true, enrollment: active.toObject() };
      }
    }
    throw err;
  }

  // To be paid online (gateway on): it is only an enrollment once the money
  // arrives, so no "arranged offline" email or bell now — the active email
  // and bell confirm it (transitionEnrollment → "active").
  const payOnline =
    status === "pending" && (await onlinePointAvailable("courses"));
  if (!payOnline) {
    await sendEnrollmentEmail(
      enrollment.toObject(),
      localize(course.title, "en"),
      status === "active" ? "active" : "pending",
    ).catch((e) => logger.warn("enrollment email failed", e));
    if (!args.grant) {
      await notifyEnrollment(enrollment, localize(course.title, "en"), false);
    }
  }

  return { ok: true, enrollment: enrollment.toObject() };
}

/** The team's bell: a new enrollment (or one just paid online). */
async function notifyEnrollment(
  enrollment: Pick<
    IEnrollment,
    "enrollmentNumber" | "totalMinor" | "email" | "courseId"
  > & { _id?: unknown },
  courseTitle: string | null,
  paidOnline: boolean,
) {
  const title =
    courseTitle ??
    (await Course.findById(enrollment.courseId)
      .select("title")
      .lean()
      .exec()
      .then((c) => (c ? localize(c.title, "en") : "a course"))
      .catch(() => "a course"));
  await notifyAdmins({
    type: "enrollment.created",
    severity: "success",
    title: paidOnline
      ? `New enrollment ${enrollment.enrollmentNumber} — paid online`
      : `New enrollment ${enrollment.enrollmentNumber}`,
    body: `${title} · ${formatBDT(enrollment.totalMinor)} · ${enrollment.email}`,
    href: `/admin/enrollments/${String(enrollment._id)}`,
    entity: {
      kind: "Enrollment",
      id: String(enrollment._id),
      ref: enrollment.enrollmentNumber,
    },
  });
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
  opts: {
    note?: string;
    /** Refunding money taken online: how it went back (bKash/bank ref). */
    refundReference?: string;
    actorId?: string | null;
    /** Payment fields to write in the same move (the gateway's reference). */
    payment?: Partial<Record<"provider" | "txnId", string>>;
  } = {},
): Promise<EnrollmentTransitionResult> {
  await connectToDatabase();
  const current = await getEnrollmentById(enrollmentId);
  if (!current) return { ok: false, code: "not_found" };
  if (!ENROLLMENT_TRANSITIONS[current.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }

  const now = new Date();
  const wasPaid = current.payment.status === "paid";
  const set: Record<string, unknown> = { status: to };
  // Activating a pending (paid) enrollment confirms payment + grants access.
  if (to === "active") {
    set["payment.status"] = "paid";
    set["payment.paidAt"] = now;
  }
  if (to === "refunded") set["payment.status"] = "refunded";
  for (const [k, v] of Object.entries(opts.payment ?? {})) {
    if (v) set[`payment.${k}`] = v;
  }
  // One conditional write on the status just read: an online payment and an
  // admin activating by hand cannot both win.
  const enrollment = await Enrollment.findOneAndUpdate(
    { _id: current._id, status: current.status },
    {
      $set: set,
      $push: { timeline: { status: to, at: now, note: opts.note } },
    },
    { returnDocument: "after" },
  ).exec();
  if (!enrollment) return { ok: false, code: "invalid_transition" };

  // Return the coupon's redemption slot on cancel/refund (terminal states, so
  // this runs at most once per enrollment).
  if ((to === "cancelled" || to === "refunded") && enrollment.couponCode) {
    await releaseCouponUsageByCode(enrollment.couponCode).catch((e) =>
      logger.warn("coupon release failed", e),
    );
  }
  if ((to === "cancelled" || to === "refunded") && wasPaid) {
    // Money taken online goes back by hand: record how, or queue it.
    await markSubjectPaymentsForRefund("enrollment", String(enrollment._id), {
      reference: opts.refundReference,
      note: opts.note,
      actorId: opts.actorId,
    }).catch((e) =>
      logger.error("could not mark online payment for refund", e),
    );
  }
  if (to === "active" && opts.payment?.provider) {
    await notifyEnrollment(enrollment, null, true);
  }

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
  // Bound the attempt history so a determined student can't grow the document
  // without limit (keep the most recent 50 attempts).
  if (enrollment.quizScores.length > 50) {
    enrollment.quizScores = enrollment.quizScores.slice(-50);
  }
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
  const built =
    event === "active"
      ? renderEmail({
          accent: "orange",
          preheader: `Your enrollment in "${courseTitle}" is active.`,
          eyebrow: "Enrollment active",
          heading: "You're enrolled — start learning",
          paragraphs: [
            `Your enrollment in "${courseTitle}" is now active. You can start learning right away.`,
          ],
          details: {
            rows: [
              { label: "Course", value: courseTitle },
              { label: "Reference", value: e.enrollmentNumber },
            ],
          },
          button: {
            label: "Go to your courses",
            url: `${siteConfig.url}/en/medacademy`,
          },
        })
      : renderEmail({
          accent: "orange",
          preheader: `We received your enrollment in "${courseTitle}".`,
          eyebrow: "Enrollment received",
          heading: "We've received your enrollment",
          paragraphs: [
            `Thanks for enrolling in "${courseTitle}". Payment is arranged offline — your access opens as soon as it's confirmed.`,
          ],
          details: {
            rows: [
              { label: "Course", value: courseTitle },
              {
                label: "Total due",
                value: formatBDT(e.totalMinor),
                strong: true,
              },
              { label: "Reference", value: e.enrollmentNumber },
            ],
          },
        });
  await getMailer().send({
    to: e.email,
    subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendCompletionEmail(e: IEnrollment, courseTitle: string) {
  const certUrl = e.certificateId
    ? `${siteConfig.url}/en/medacademy/certificate/${e.certificateId}`
    : undefined;
  const built = renderEmail({
    accent: "orange",
    preheader: `You completed "${courseTitle}" — your certificate is ready.`,
    eyebrow: "Course completed",
    heading: "Congratulations! 🎉",
    paragraphs: [
      `You've completed "${courseTitle}". Your certificate is ready — view or print it any time from your account.`,
    ],
    details: e.certificateId
      ? {
          rows: [
            { label: "Course", value: courseTitle },
            { label: "Certificate ID", value: e.certificateId },
          ],
        }
      : undefined,
    button: certUrl
      ? { label: "View your certificate", url: certUrl }
      : undefined,
  });
  await getMailer().send({
    to: e.email,
    subject: `Course completed: ${courseTitle}`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
