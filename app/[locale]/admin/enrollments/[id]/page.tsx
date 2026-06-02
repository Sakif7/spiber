import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { EnrollmentActions } from "@/components/admin/academy/enrollment-actions";
import { getEnrollmentById } from "@/lib/repositories/enrollments.repo";
import { getCourseById, flattenLessons } from "@/lib/repositories/courses.repo";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";

export const dynamic = "force-dynamic";

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  borderRadius: "var(--r-lg)",
  padding: "var(--s-5)",
};

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
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: "var(--s-2)" }}>
        <Link
          href="/admin/enrollments"
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          ← Enrollments
        </Link>
        <h1
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-h3)",
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          {e.enrollmentNumber}
        </h1>
      </div>

      <div
        className="equal-2col"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
          gap: "var(--s-5)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "var(--s-5)" }}>
          <div style={{ ...cardStyle, display: "grid", gap: "var(--s-3)" }}>
            <Row label="Course" value={courseTitle} />
            <Row label="Student" value={e.email} />
            <Row label="Status" value={e.status} />
            <Row label="Payment" value={e.payment?.status ?? "—"} />
            <Row
              label="Total"
              value={e.totalMinor > 0 ? formatBDT(e.totalMinor, "en") : "Free"}
            />
            {e.couponCode && <Row label="Coupon" value={e.couponCode} />}
            <Row
              label="Progress"
              value={`${done}/${lessons.length} lessons · ${percent}%`}
            />
            {e.completedAt && (
              <Row label="Certificate" value={e.certificateId ?? "—"} />
            )}
          </div>

          <div style={{ ...cardStyle, display: "grid", gap: "var(--s-3)" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--fs-lg)",
                color: "var(--color-text-strong)",
              }}
            >
              Timeline
            </h2>
            {e.timeline.length === 0 ? (
              <p
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--fs-sm)",
                }}
              >
                No events.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: 10,
                }}
              >
                {e.timeline.map((entry, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: "var(--s-3)",
                      fontSize: "var(--fs-sm)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--color-text-strong)",
                        textTransform: "capitalize",
                        minWidth: 90,
                      }}
                    >
                      {entry.status}
                    </span>
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {new Date(entry.at).toLocaleString()}
                      {entry.note ? ` — ${entry.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <EnrollmentActions enrollmentId={id} status={e.status} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--s-4)",
      }}
    >
      <span
        style={{ color: "var(--color-text-muted)", fontSize: "var(--fs-sm)" }}
      >
        {label}
      </span>
      <strong
        style={{
          color: "var(--color-text-strong)",
          textTransform:
            label === "Status" || label === "Payment" ? "capitalize" : "none",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
