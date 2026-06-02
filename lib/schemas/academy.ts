import { z } from "zod";
import { localizedSchema } from "./localized";

/**
 * Spiber Academy (LMS) content model. Zod is the single source of truth;
 * Mongoose models + TS types derive from it. Money is integer poisha.
 * Localized fields are { en, bn }. A Course embeds Modules → Lessons; each
 * module/lesson carries a stable string `id` (referenced by enrollment
 * progress), generated server-side when absent.
 */

export const courseLevelEnum = z.enum(["beginner", "intermediate", "advanced"]);
export type CourseLevel = z.infer<typeof courseLevelEnum>;

export const courseStatusEnum = z.enum(["draft", "published", "archived"]);
export type CourseStatus = z.infer<typeof courseStatusEnum>;

export const lessonTypeEnum = z.enum(["video", "text", "quiz", "resource"]);
export type LessonType = z.infer<typeof lessonTypeEnum>;

export const videoStatusEnum = z.enum([
  "uploading",
  "processing",
  "ready",
  "error",
]);
export type VideoStatus = z.infer<typeof videoStatusEnum>;

// ---- Quiz (embedded when lesson.type === "quiz") ----
export const quizOptionSchema = z.object({
  id: z.string().min(1),
  text: localizedSchema,
});
export const quizQuestionSchema = z.object({
  // Optional on input (the API backfills); nothing references a question id.
  id: z.string().optional(),
  prompt: localizedSchema,
  options: z.array(quizOptionSchema).min(2),
  correctOptionId: z.string().min(1),
  explanation: localizedSchema.optional(),
});
export const quizSchema = z.object({
  passPercent: z.number().int().min(1).max(100).default(70),
  questions: z.array(quizQuestionSchema).default([]),
});
export type QuizInput = z.infer<typeof quizSchema>;

// ---- Lesson ----
export const lessonResourceSchema = z.object({
  name: z.string().min(1).max(200),
  fileKey: z.string().min(1),
});

export const lessonSchema = z.object({
  // Stable id of an existing embedded lesson; the API fills it when blank.
  id: z.string().optional(),
  title: localizedSchema,
  order: z.number().int().nonnegative().default(0),
  type: lessonTypeEnum,
  videoUid: z.string().optional(),
  videoStatus: videoStatusEnum.optional(),
  durationSec: z.number().int().nonnegative().optional(),
  body: localizedSchema.optional(),
  resources: z.array(lessonResourceSchema).default([]),
  isFreePreview: z.boolean().default(false),
  quiz: quizSchema.optional(),
});
export type LessonInput = z.infer<typeof lessonSchema>;

// ---- Module ----
export const moduleSchema = z.object({
  id: z.string().optional(),
  title: localizedSchema,
  order: z.number().int().nonnegative().default(0),
  lessons: z.array(lessonSchema).default([]),
});
export type ModuleInput = z.infer<typeof moduleSchema>;

// ---- Course ----
// `slug` is optional on input; the route derives it from `title.en` when blank.
export const courseSchema = z.object({
  title: localizedSchema,
  slug: z.string().max(160).optional(),
  summary: localizedSchema.optional(),
  description: localizedSchema.optional(),
  thumbnail: z.string().optional(),
  level: courseLevelEnum.default("beginner"),
  priceMinor: z.number().int().nonnegative().default(0),
  instructorId: z.string().optional(),
  status: courseStatusEnum.default("draft"),
  modules: z.array(moduleSchema).default([]),
});
export type CourseInput = z.infer<typeof courseSchema>;
