import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { CtaButton } from "@/components/ui/cta-button";
import { getEnrollmentByNumber } from "@/lib/repositories/enrollments.repo";
import { getCourseById, flattenLessons } from "@/lib/repositories/courses.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function EnrollmentPage({
  params,
}: {
  params: Promise<{ locale: string; number: string }>;
}) {
  const { locale, number } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "academy.enrollment" });

  const user = await getSessionUser();
  if (!user) {
    redirect(
      `/${locale}?auth=login&next=/${locale}/medacademy/enrollment/${number}`,
    );
  }

  const enrollment = await getEnrollmentByNumber(number);
  if (!enrollment || String(enrollment.userId) !== user.sub) notFound();

  const course = await getCourseById(String(enrollment.courseId));
  const courseTitle = course ? localize(course.title, l) : "";
  const firstLessonId = course
    ? flattenLessons(course.toObject())[0]?.id
    : undefined;
  const active = enrollment.status === "active";

  return (
    <section style={{ paddingBlock: "clamp(64px, 9vw, 140px)" }}>
      <Container
        style={{
          maxWidth: 600,
          display: "grid",
          gap: "var(--s-5)",
          textAlign: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            justifySelf: "center",
            display: "grid",
            placeItems: "center",
            width: 56,
            height: 56,
            borderRadius: "var(--r-pill)",
            background: active
              ? "var(--color-brand-soft)"
              : "var(--color-secondary-soft)",
            color: active
              ? "var(--color-brand-deep)"
              : "var(--color-secondary-deep)",
            fontSize: 28,
          }}
        >
          {active ? "✓" : "•"}
        </span>
        <h1
          style={{
            fontSize: "var(--fs-h2)",
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          {active ? t("activeTitle") : t("pendingTitle")}
        </h1>
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-body-lg)",
            margin: 0,
          }}
        >
          {courseTitle ? `${courseTitle} — ` : ""}
          {active ? t("activeNote") : t("pendingNote")}
        </p>

        <div
          style={{
            display: "grid",
            gap: 8,
            padding: "var(--s-5)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-lg)",
            background: "var(--color-surface)",
            textAlign: "left",
          }}
        >
          <Row
            label={t("reference")}
            value={enrollment.enrollmentNumber}
            mono
          />
          <Row
            label={t("total")}
            value={
              enrollment.totalMinor > 0
                ? formatBDT(enrollment.totalMinor, l)
                : "Free"
            }
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--s-3)",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {active && course && (
            <CtaButton
              href={
                firstLessonId
                  ? `/medacademy/course/${course.slug}/learn/${firstLessonId}`
                  : `/medacademy/course/${course.slug}`
              }
              style={{ background: "var(--color-secondary)" }}
            >
              {t("goToCourse")}
            </CtaButton>
          )}
          <CtaButton href="/account/courses" variant="secondary">
            {t("viewCourses")}
          </CtaButton>
        </div>
      </Container>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--s-4)",
      }}
    >
      <span
        style={{
          color: "var(--color-text-muted)",
          fontSize: "var(--fs-body-sm)",
        }}
      >
        {label}
      </span>
      <strong
        style={{
          color: "var(--color-text-strong)",
          fontFamily: mono ? "var(--font-mono)" : "inherit",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
