import mongoose, { Schema, type Model } from "mongoose";
import type { IPaymentRef } from "@/lib/models/order";
import type { EnrollmentStatus } from "@/lib/schemas/enrollment";

export interface IEnrollmentProgress {
  lessonId: string;
  completedAt: Date;
}

export interface IQuizScore {
  lessonId: string;
  scorePercent: number;
  passed: boolean;
  attemptedAt: Date;
}

export interface IEnrollTimelineEntry {
  status: EnrollmentStatus;
  at: Date;
  note?: string;
}

export interface IEnrollment {
  enrollmentNumber: string;
  userId: mongoose.Types.ObjectId | string;
  courseId: mongoose.Types.ObjectId | string;
  email: string;
  status: EnrollmentStatus;
  payment: IPaymentRef;
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: "BDT";
  couponCode?: string;
  idempotencyKey: string;
  progress: IEnrollmentProgress[];
  quizScores: IQuizScore[];
  lastLessonId?: string;
  completedAt?: Date | null;
  certificateId?: string | null;
  timeline: IEnrollTimelineEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const progressSchema = new Schema<IEnrollmentProgress>(
  {
    lessonId: { type: String, required: true },
    completedAt: { type: Date, required: true },
  },
  { _id: false },
);

const quizScoreSchema = new Schema<IQuizScore>(
  {
    lessonId: { type: String, required: true },
    scorePercent: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    attemptedAt: { type: Date, required: true },
  },
  { _id: false },
);

const enrollmentSchema = new Schema<IEnrollment>(
  {
    enrollmentNumber: { type: String, required: true, unique: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "active", "cancelled", "refunded"],
      default: "pending",
      index: true,
    },
    payment: {
      provider: { type: String, default: "manual" },
      txnId: String,
      status: { type: String, default: "unpaid" },
      raw: Schema.Types.Mixed,
      paidAt: { type: Date, default: null },
    },
    subtotalMinor: { type: Number, required: true },
    discountMinor: { type: Number, default: 0 },
    totalMinor: { type: Number, required: true },
    currency: { type: String, default: "BDT" },
    couponCode: String,
    idempotencyKey: { type: String, required: true },
    progress: { type: [progressSchema], default: [] },
    quizScores: { type: [quizScoreSchema], default: [] },
    lastLessonId: { type: String },
    completedAt: { type: Date, default: null },
    certificateId: { type: String, default: null },
    timeline: {
      type: [
        new Schema<IEnrollTimelineEntry>(
          { status: String, at: Date, note: String },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { collection: "enrollments", timestamps: true },
);

// Idempotent enrollment creation: same key never creates two records.
enrollmentSchema.index({ idempotencyKey: 1 }, { unique: true });
// At most ONE live (pending|active) enrollment per user+course, enforced at the
// DB layer so concurrent enrolls (double-click / two tabs with different
// idempotency keys) can't create duplicates. Partial filter expressions DO
// support $in, so cancelled/refunded records are exempt and can be re-enrolled.
enrollmentSchema.index(
  { userId: 1, courseId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "active"] } },
  },
);
// Unique + indexed certificate id (sole credential for the certificate page);
// partial so the many null certificateIds don't collide.
enrollmentSchema.index(
  { certificateId: 1 },
  {
    unique: true,
    partialFilterExpression: { certificateId: { $type: "string" } },
  },
);
enrollmentSchema.index({ courseId: 1, status: 1 });
enrollmentSchema.index({ createdAt: -1 });

export const Enrollment: Model<IEnrollment> =
  (mongoose.models.Enrollment as Model<IEnrollment>) ??
  mongoose.model<IEnrollment>("Enrollment", enrollmentSchema);
