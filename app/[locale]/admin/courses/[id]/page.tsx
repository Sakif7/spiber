import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import { getCourseById } from "@/lib/repositories/courses.repo";
import { enrollmentCountsByCourse } from "@/lib/repositories/enrollments.repo";
import { formatBDT } from "@/lib/money";
import {
  CourseBuilder,
  type CourseBuilderInitial,
} from "@/components/admin/academy/course-builder";

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
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}
    >
      <div style={{ display: "grid", gap: "var(--s-2)" }}>
        <Link
          href="/admin/courses"
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          ← Courses
        </Link>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          {localize(c.title, "en") || "Untitled course"}
        </h1>
      </div>
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "var(--s-4)",
          }}
        >
          {[
            { label: "Enrollments", value: String(stats.total) },
            { label: "Active", value: String(stats.active) },
            { label: "Completion", value: `${completionRate}%` },
            { label: "Revenue", value: formatBDT(stats.revenueMinor, "en") },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                borderRadius: "var(--r-lg)",
                padding: "var(--s-4)",
                display: "grid",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-caption)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-eyebrow)",
                  color: "var(--color-text-muted)",
                }}
              >
                {s.label}
              </span>
              <strong
                style={{
                  fontSize: "var(--fs-h4)",
                  color: "var(--color-text-strong)",
                }}
              >
                {s.value}
              </strong>
            </div>
          ))}
        </div>
      )}
      <CourseBuilder initial={initial} />
    </div>
  );
}
