import { z } from "zod";

/**
 * Enrollment + progress for the Academy LMS. An Enrollment is its own entity
 * (not an Order) with its own PaymentRef, mirroring the order lifecycle:
 * pending → active (paid/granted) with cancel/refund branches. Completion is a
 * flag (`completedAt`), not a status. Money is integer poisha.
 */

export const enrollmentStatusEnum = z.enum([
  "pending",
  "active",
  "cancelled",
  "refunded",
]);
export type EnrollmentStatus = z.infer<typeof enrollmentStatusEnum>;

/** Allowed status transitions enforced by the enrollment service. */
export const ENROLLMENT_TRANSITIONS: Record<
  EnrollmentStatus,
  EnrollmentStatus[]
> = {
  pending: ["active", "cancelled"],
  active: ["refunded", "cancelled"],
  cancelled: [],
  refunded: [],
};

/** Student enroll request. Server re-prices; never trusts client amounts. */
export const enrollInputSchema = z.object({
  courseId: z.string().min(1),
  couponCode: z.string().trim().max(64).optional(),
  idempotencyKey: z.string().min(8).max(128),
});
export type EnrollInput = z.infer<typeof enrollInputSchema>;

/** Admin enrollment status transition. */
export const enrollmentTransitionSchema = z.object({
  to: enrollmentStatusEnum,
  note: z.string().max(1000).optional(),
});
export type EnrollmentTransitionInput = z.infer<
  typeof enrollmentTransitionSchema
>;

/** Admin manual enroll (grant access without payment). */
export const manualEnrollSchema = z.object({
  courseId: z.string().min(1),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email(),
  ),
});
export type ManualEnrollInput = z.infer<typeof manualEnrollSchema>;

/** Mark a lesson complete (progress). */
export const lessonCompleteSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
});
export type LessonCompleteInput = z.infer<typeof lessonCompleteSchema>;

/** Submit answers for a quiz lesson. */
export const quizSubmitSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        optionId: z.string().min(1),
      }),
    )
    .min(1),
});
export type QuizSubmitInput = z.infer<typeof quizSubmitSchema>;
