import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { CtaButton } from "@/components/ui/cta-button";
import { Link } from "@/i18n/navigation";
import {
  LessonPlayer,
  type PlayerLesson,
} from "@/components/academy/lesson-player";
import {
  getCourseBySlug,
  flattenLessons,
  findLesson,
} from "@/lib/repositories/courses.repo";
import { getActiveEnrollment } from "@/lib/repositories/enrollments.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { getVideoProvider } from "@/lib/video";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; lessonId: string }>;
}) {
  const { locale, slug, lessonId } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "academy.player" });

  const course = await getCourseBySlug(slug);
  if (!course || course.status !== "published") notFound();
  const lesson = findLesson(course, lessonId);
  if (!lesson) notFound();

  const user = await getSessionUser();
  const enrollment = user
    ? await getActiveEnrollment(user.sub, String(course._id))
    : null;
  const enrolled = enrollment?.status === "active";
  const accessible = lesson.isFreePreview || enrolled;

  // Gated: not a free preview and the user isn't enrolled.
  if (!accessible) {
    return (
      <section style={{ paddingBlock: "clamp(64px, 9vw, 140px)" }}>
        <Container
          style={{
            maxWidth: 560,
            textAlign: "center",
            display: "grid",
            gap: "var(--s-5)",
          }}
        >
          <h1
            style={{
              fontSize: "var(--fs-h3)",
              color: "var(--color-text-strong)",
            }}
          >
            {t("notEnrolled")}
          </h1>
          <div style={{ justifySelf: "center" }}>
            <CtaButton
              href={`/academy/course/${slug}`}
              style={{ background: "var(--color-secondary)" }}
            >
              {t("viewCourse")}
            </CtaButton>
          </div>
        </Container>
      </section>
    );
  }

  const provider = getVideoProvider();
  let playbackUrl: string | null = null;
  let mediaKind: "audio" | "video" = "video";
  if (lesson.type === "video" && lesson.videoUid) {
    if (provider.playbackKind === "stream") {
      // Cloudflare Stream serves its own signed iframe playback.
      playbackUrl = await provider
        .getPlaybackUrl(lesson.videoUid)
        .catch(() => null);
    } else {
      // R2/local: stream through the gated route (enrollment-checked, Range).
      playbackUrl = `/api/media/lesson/${String(course._id)}/${lesson.id}`;
      mediaKind = /\.(mp3|m4a|aac|wav|ogg|oga)$/i.test(lesson.videoUid)
        ? "audio"
        : "video";
    }
  }

  const flat = flattenLessons(course);
  const idx = flat.findIndex((x) => x.id === lessonId);
  const prevId = idx > 0 ? flat[idx - 1].id : undefined;
  const nextId =
    idx >= 0 && idx < flat.length - 1 ? flat[idx + 1].id : undefined;

  const completedIds = (enrollment?.progress ?? []).map((p) => p.lessonId);

  // Build the nav list (module-flattened) with completion state.
  const navLessons = flat.map((x) => ({
    id: x.id,
    title: x.title,
    type: x.type,
    completed: completedIds.includes(x.id),
  }));

  // Current lesson content for the client — never leak quiz answers.
  const playerLesson: PlayerLesson = {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    body: lesson.body,
    resources: lesson.resources ?? [],
    quiz:
      lesson.type === "quiz" && lesson.quiz
        ? {
            passPercent: lesson.quiz.passPercent,
            questions: lesson.quiz.questions.map((q) => ({
              id: q.id,
              prompt: q.prompt,
              options: q.options.map((o) => ({ id: o.id, text: o.text })),
            })),
          }
        : undefined,
  };

  return (
    <section style={{ paddingBlock: "clamp(28px, 4vw, 56px)" }}>
      <Container
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
      >
        <Link
          href={`/academy/course/${slug}`}
          style={{
            fontSize: "var(--fs-small)",
            color: "var(--color-text-muted)",
          }}
        >
          ← {localize(course.title, l)}
        </Link>
        <LessonPlayer
          courseId={String(course._id)}
          slug={course.slug}
          locale={l}
          enrolled={Boolean(enrolled)}
          lesson={playerLesson}
          playbackUrl={playbackUrl}
          playbackKind={provider.playbackKind}
          mediaKind={mediaKind}
          lessons={navLessons}
          prevId={prevId}
          nextId={nextId}
          initialCompletedIds={completedIds}
        />
      </Container>
    </section>
  );
}
