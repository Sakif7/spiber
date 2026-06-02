import mongoose from "mongoose";
import { slugify } from "@/lib/slug";
import type { CourseInput } from "@/lib/schemas/academy";
import type { ICourse, IModule, ILesson } from "@/lib/models/course";

function genId(): string {
  return new mongoose.Types.ObjectId().toString();
}

/**
 * Normalize admin course-builder input into a persistable course document:
 * derive the slug, assign stable ids to any new modules/lessons/quiz parts,
 * and re-number `order` from array position so the saved tree matches the UI.
 */
export function toCourseDoc(input: CourseInput): Partial<ICourse> {
  const modules: IModule[] = (input.modules ?? []).map((m, mi) => {
    const lessons: ILesson[] = (m.lessons ?? []).map((l, li) => {
      const lesson: ILesson = {
        id: l.id || genId(),
        title: l.title,
        order: li,
        type: l.type,
        videoUid: l.videoUid,
        videoStatus: l.videoStatus,
        durationSec: l.durationSec,
        body: l.body,
        resources: l.resources ?? [],
        isFreePreview: l.isFreePreview ?? false,
        quiz:
          l.type === "quiz" && l.quiz
            ? {
                passPercent: l.quiz.passPercent ?? 70,
                questions: (l.quiz.questions ?? []).map((q) => ({
                  id: q.id || genId(),
                  prompt: q.prompt,
                  options: q.options.map((o) => ({
                    id: o.id || genId(),
                    text: o.text,
                  })),
                  correctOptionId: q.correctOptionId,
                  explanation: q.explanation,
                })),
              }
            : undefined,
      };
      return lesson;
    });
    return {
      id: m.id || genId(),
      title: m.title,
      order: mi,
      lessons,
    };
  });

  return {
    title: input.title,
    slug: slugify(input.slug || input.title.en),
    summary: input.summary,
    description: input.description,
    thumbnail: input.thumbnail,
    level: input.level,
    priceMinor: input.priceMinor,
    instructorId: input.instructorId
      ? new mongoose.Types.ObjectId(input.instructorId)
      : null,
    status: input.status,
    modules,
  };
}
