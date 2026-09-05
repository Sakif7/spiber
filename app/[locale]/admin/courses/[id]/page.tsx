import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { localize } from "@/lib/schemas/localized";
import { getCourseById } from "@/lib/repositories/courses.repo";
import { enrollmentCountsByCourse } from "@/lib/repositories/enrollments.repo";
import { formatBDT } from "@/lib/money";
import {
  CourseBuilder,
  type CourseBuilderInitial,
} from "@/components/admin/academy/course-builder";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Loc = { en?: string; bn?: string; ja?: string } | undefined;
const mapL = (v: Loc) => ({
  en: v?.en ?? "",
  bn: v?.bn ?? "",
  ja: v?.ja ?? "",
});

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const doc = await getCourseById(id);
  if (!doc) notFound();
  const c = doc.toObject();
  const stats = await enrollmentCountsByCourse(id).catch(() => null);
  const completionRate =
    stats && stats.active > 0
      ? Math.round((stats.completed / stats.active) * 100)
      : 0;

  const initial: CourseBuilderInitial = {
    id: String(c._id),
    title: mapL(c.title),
    slug: c.slug,
    summary: mapL(c.summary),
    description: mapL(c.description),
    thumbnail: c.thumbnail ?? "",
    level: c.level,
    priceMinor: c.priceMinor,
    status: c.status,
    modules: (c.modules ?? []).map((m) => ({
      id: m.id,
      title: mapL(m.title),
      lessons: (m.lessons ?? []).map((l) => ({
        id: l.id,
        title: mapL(l.title),
        type: l.type,
        videoUid: l.videoUid ?? "",
        videoStatus: l.videoStatus ?? "",
        durationSec: l.durationSec,
        body: mapL(l.body),
        resources: (l.resources ?? []).map((r) => ({
          name: r.name,
          fileKey: r.fileKey,
        })),
        isFreePreview: Boolean(l.isFreePreview),
        quiz: {
          passPercent: l.quiz?.passPercent ?? 70,
          questions: (l.quiz?.questions ?? []).map((q) => ({
            id: q.id,
            prompt: mapL(q.prompt),
            options: q.options.map((o) => ({ id: o.id, text: mapL(o.text) })),
            correctOptionId: q.correctOptionId,
            explanation: mapL(q.explanation),
          })),
        },
      })),
    })),
  };

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/courses"
        backLabel="Courses"
        title={localize(c.title, "en") || "Untitled course"}
      />
      {stats && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
          {[
            { label: "Enrollments", value: String(stats.total) },
            { label: "Active", value: String(stats.active) },
            { label: "Completion", value: `${completionRate}%` },
            { label: "Revenue", value: formatBDT(stats.revenueMinor, "en") },
          ].map((s) => (
            <Card key={s.label} className="gap-1 p-4">
              <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.12em] uppercase">
                {s.label}
              </span>
              <strong className="text-foreground text-xl leading-tight font-bold tabular-nums">
                {s.value}
              </strong>
            </Card>
          ))}
        </div>
      )}
      <CourseBuilder initial={initial} />
    </div>
  );
}
