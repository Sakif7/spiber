import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CtaButton } from "@/components/ui/cta-button";
import { Link } from "@/i18n/navigation";
import { listEnrollmentsByUser } from "@/lib/repositories/enrollments.repo";
import { getCourseById, flattenLessons } from "@/lib/repositories/courses.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function MyCoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "academy.dashboard" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}?auth=login&next=/${locale}/account/courses`);
  }

  type Card = {
    slug: string;
    title: string;
    status: string;
    percent: number;
    resumeId?: string;
    completed: boolean;
  };
  let cards: Card[] = [];
  try {
    const enrollments = await listEnrollmentsByUser(user.sub);
    const courses = await Promise.all(
      enrollments.map((e) =>
        getCourseById(String(e.courseId)).catch(() => null),
      ),
    );
    cards = enrollments.map((e, i) => {
      const course = courses[i];
      const lessons = course ? flattenLessons(course.toObject()) : [];
      const validIds = new Set(lessons.map((x) => x.id));
      const done = e.progress.filter((p) => validIds.has(p.lessonId)).length;
      const percent = lessons.length
        ? Math.round((done / lessons.length) * 100)
        : 0;
      const resumeId =
        e.lastLessonId && validIds.has(e.lastLessonId)
          ? e.lastLessonId
          : lessons[0]?.id;
      return {
        slug: course?.slug ?? "",
        title: course ? localize(course.title, l) : "—",
        status: e.status,
        percent,
        resumeId,
        completed: Boolean(e.completedAt),
      };
    });
  } catch (e) {
    logger.warn("my courses load failed", e);
  }

  return (
    <>
      <PageHeader
        eyebrow={nav("academy")}
        title={t("title")}
        breadcrumbs={[{ label: nav("home"), href: "/" }, { label: t("title") }]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container>
          {cards.length === 0 ? (
            <div
              style={{
                display: "grid",
                gap: "var(--s-5)",
                justifyItems: "start",
              }}
            >
              <p style={{ color: "var(--color-text-muted)" }}>{t("empty")}</p>
              <CtaButton
                href="/academy/courses"
                style={{ background: "var(--color-secondary)" }}
              >
                {t("browse")}
              </CtaButton>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--s-4)" }}>
              {cards.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--s-5)",
                    flexWrap: "wrap",
                    padding: "var(--s-5)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--r-lg)",
                    background: "var(--color-surface)",
                  }}
                >
                  <div
                    style={{ flex: 1, minWidth: 220, display: "grid", gap: 8 }}
                  >
                    <Link
                      href={`/academy/course/${c.slug}`}
                      style={{
                        fontWeight: 600,
                        color: "var(--color-text-strong)",
                        textDecoration: "none",
                      }}
                    >
                      {c.title}
                    </Link>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: "var(--color-surface-2)",
                        overflow: "hidden",
                        maxWidth: 320,
                      }}
                    >
                      <div
                        style={{
                          width: `${c.percent}%`,
                          height: "100%",
                          background: "var(--color-secondary)",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "var(--fs-caption)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {c.status === "pending"
                        ? t("pending")
                        : c.completed
                          ? t("completed")
                          : t("progress", { percent: c.percent })}
                    </span>
                  </div>
                  {c.status === "active" && c.resumeId && (
                    <CtaButton
                      href={`/academy/course/${c.slug}/learn/${c.resumeId}`}
                      style={{ background: "var(--color-secondary)" }}
                    >
                      {c.percent > 0 ? t("resume") : t("start")}
                    </CtaButton>
                  )}
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
