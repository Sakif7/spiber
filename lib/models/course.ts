import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type {
  CourseLevel,
  CourseStatus,
  LessonType,
  VideoStatus,
} from "@/lib/schemas/academy";

export interface IQuizOption {
  id: string;
  text: LocalizedDoc;
}
export interface IQuizQuestion {
  id: string;
  prompt: LocalizedDoc;
  options: IQuizOption[];
  correctOptionId: string;
  explanation?: LocalizedDoc;
}
export interface IQuiz {
  passPercent: number;
  questions: IQuizQuestion[];
}
export interface ILessonResource {
  name: string;
  fileKey: string;
}
export interface ILesson {
  id: string;
  title: LocalizedDoc;
  order: number;
  type: LessonType;
  videoUid?: string;
  videoStatus?: VideoStatus;
  durationSec?: number;
  body?: LocalizedDoc;
  resources: ILessonResource[];
  isFreePreview: boolean;
  quiz?: IQuiz;
}
export interface IModule {
  id: string;
  title: LocalizedDoc;
  order: number;
  lessons: ILesson[];
}
export interface ICourse {
  title: LocalizedDoc;
  slug: string;
  summary?: LocalizedDoc;
  description?: LocalizedDoc;
  thumbnail?: string;
  level: CourseLevel;
  priceMinor: number;
  instructorId?: mongoose.Types.ObjectId | string | null;
  status: CourseStatus;
  modules: IModule[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const quizOptionSchema = new Schema<IQuizOption>(
  { id: { type: String, required: true }, text: { ...localizedDef } },
  { _id: false },
);

const quizQuestionSchema = new Schema<IQuizQuestion>(
  {
    id: { type: String, required: true },
    prompt: { ...localizedDef },
    options: { type: [quizOptionSchema], default: [] },
    correctOptionId: { type: String, required: true },
    explanation: { en: { type: String }, bn: { type: String } },
  },
  { _id: false },
);

const quizDocSchema = new Schema<IQuiz>(
  {
    passPercent: { type: Number, default: 70, min: 1, max: 100 },
    questions: { type: [quizQuestionSchema], default: [] },
  },
  { _id: false },
);

const lessonResourceSchema = new Schema<ILessonResource>(
  {
    name: { type: String, required: true },
    fileKey: { type: String, required: true },
  },
  { _id: false },
);

// Modules and lessons carry a stable string `id` (referenced by enrollment
// progress); the embedded `_id` is disabled so the whole tree can be saved
// wholesale without churning identities.
const lessonSchema = new Schema<ILesson>(
  {
    id: { type: String, required: true },
    title: { ...localizedDef },
    order: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ["video", "text", "quiz", "resource"],
      required: true,
    },
    videoUid: { type: String },
    videoStatus: {
      type: String,
      enum: ["uploading", "processing", "ready", "error"],
    },
    durationSec: { type: Number },
    body: { en: { type: String }, bn: { type: String } },
    resources: { type: [lessonResourceSchema], default: [] },
    isFreePreview: { type: Boolean, default: false },
    quiz: { type: quizDocSchema, default: undefined },
  },
  { _id: false },
);

const moduleSchema = new Schema<IModule>(
  {
    id: { type: String, required: true },
    title: { ...localizedDef },
    order: { type: Number, default: 0 },
    lessons: { type: [lessonSchema], default: [] },
  },
  { _id: false },
);

const courseSchema = new Schema<ICourse>(
  {
    title: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    summary: { en: { type: String }, bn: { type: String } },
    description: { en: { type: String }, bn: { type: String } },
    thumbnail: { type: String },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
      index: true,
    },
    priceMinor: { type: Number, default: 0 },
    instructorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    modules: { type: [moduleSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { collection: "courses", timestamps: true },
);

// Unique slug among non-deleted courses (soft-deleted rows free their slug).
courseSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
courseSchema.index({
  "title.en": "text",
  "title.bn": "text",
  "summary.en": "text",
});
courseSchema.index({ status: 1, level: 1, priceMinor: 1 });

export const Course: Model<ICourse> =
  (mongoose.models.Course as Model<ICourse>) ??
  mongoose.model<ICourse>("Course", courseSchema);
