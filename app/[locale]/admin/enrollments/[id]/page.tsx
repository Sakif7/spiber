import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { EnrollmentActions } from "@/components/admin/academy/enrollment-actions";
import { getEnrollmentById } from "@/lib/repositories/enrollments.repo";
import { getCourseById, flattenLessons } from "@/lib/repositories/courses.repo";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import {
  DetailCard,
  DetailLayout,
  DetailRow,
} from "@/components/admin/ui/detail";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminEnrollmentDetail({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const enrollment = await getEnrollmentById(id);
  if (!enrollment) notFound();
  const e = enrollment.toObject();

  const course = await getCourseById(String(e.courseId));
  const courseTitle = course ? localize(course.title, "en") : "—";
  const lessons = course ? flattenLessons(course.toObject()) : [];
  const validIds = new Set(lessons.map((x) => x.id));
  const done = e.progress.filter((p) => validIds.has(p.lessonId)).length;
  const percent = lessons.length
    ? Math.round((done / lessons.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/enrollments"
        backLabel="Enrollments"
        title={e.enrollmentNumber}
      />

      <DetailLayout
        aside={<EnrollmentActions enrollmentId={id} status={e.status} />}
      >
        <DetailCard>
          <DetailRow label="Course">{courseTitle}</DetailRow>
          <DetailRow label="Student">{e.email}</DetailRow>
          <DetailRow label="Status">
            <StatusBadge>{e.status}</StatusBadge>
          </DetailRow>
          <DetailRow label="Payment">
            {e.payment?.status ? (
              <StatusBadge>{e.payment.status}</StatusBadge>
            ) : (
              "—"
            )}
          </DetailRow>
          <DetailRow label="Total">
            <span className="tabular-nums">
              {e.totalMinor > 0 ? formatBDT(e.totalMinor, "en") : "Free"}
            </span>
          </DetailRow>
          {e.couponCode && (
            <DetailRow label="Coupon" mono>
              {e.couponCode}
            </DetailRow>
          )}
          <DetailRow label="Progress">
            <span className="tabular-nums">
              {done}/{lessons.length} lessons · {percent}%
            </span>
          </DetailRow>
          {e.completedAt && (
            <DetailRow label="Certificate" mono>
              {e.certificateId ?? "—"}
            </DetailRow>
          )}
        </DetailCard>

        <DetailCard title="Timeline">
          {e.timeline.length === 0 ? (
            <p className="text-muted-foreground">No events.</p>
          ) : (
            <ul className="grid gap-2.5">
              {e.timeline.map((entry, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-foreground min-w-[90px] font-semibold capitalize">
                    {entry.status}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(entry.at).toLocaleString()}
                    {entry.note ? ` — ${entry.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DetailCard>
      </DetailLayout>
    </div>
  );
}
