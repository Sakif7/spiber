"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Check, ChevronLeft, ChevronRight, Award } from "lucide-react";
import { localize } from "@/lib/schemas/localized";
import { CtaButton } from "@/components/ui/cta-button";
import { QuizRunner, type QuizQuestionView } from "./quiz-runner";
import type { Locale } from "@/i18n/routing";
import type { LessonType } from "@/lib/schemas/academy";

type L = { en: string; bn?: string };
type LessonNav = { id: string; title: L; type: LessonType; completed: boolean };

export type PlayerLesson = {
  id: string;
  title: L;
  type: LessonType;
  body?: L;
  resources: { name: string; fileKey: string }[];
  quiz?: { passPercent: number; questions: QuizQuestionView[] };
};

export function LessonPlayer({
  courseId,
  slug,
  locale,
  enrolled,
  lesson,
  playbackUrl,
  playbackKind,
  mediaKind = "video",
  lessons,
  prevId,
  nextId,
  initialCompletedIds,
}: {
  courseId: string;
  slug: string;
  locale: Locale;
  enrolled: boolean;
  lesson: PlayerLesson;
  playbackUrl?: string | null;
  playbackKind?: "file" | "stream";
  mediaKind?: "audio" | "video";
  lessons: LessonNav[];
  prevId?: string;
  nextId?: string;
  initialCompletedIds: string[];
}) {
  const t = useTranslations("academy.player");
  const tc = useTranslations("academy.certificate");
  const [completed, setCompleted] = useState<Set<string>>(
    new Set(initialCompletedIds),
  );
  const [busy, setBusy] = useState(false);
  const [certificateId, setCertificateId] = useState<string | null>(null);

  const total = lessons.length;
  const done = lessons.filter((l) => completed.has(l.id)).length;
  const isDone = completed.has(lesson.id);

  async function complete() {
    if (!enrolled) return;
    setBusy(true);
    const res = await fetch("/api/academy/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, lessonId: lesson.id }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      setCompleted((s) => new Set(s).add(lesson.id));
      if (json.data.courseCompleted && json.data.certificateId) {
        setCertificateId(json.data.certificateId);
      }
    }
  }

  const lessonHref = (id: string) => `/academy/course/${slug}/learn/${id}`;

  return (
    <div
      className="lesson-shell"
      style={{
        display: "grid",
        gridTemplateColumns: "320px minmax(0, 1fr)",
        gap: "var(--s-6)",
        alignItems: "start",
      }}
    >
      {/* Curriculum sidebar */}
      <aside
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "var(--color-surface)",
          overflow: "hidden",
          position: "sticky",
          top: 88,
        }}
      >
        <div
          style={{
            padding: "var(--s-4)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              fontSize: "var(--fs-caption)",
              color: "var(--color-text-muted)",
              marginBottom: 8,
            }}
          >
            {t("progress", { done, total })}
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: "var(--color-surface-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${total ? (done / total) * 100 : 0}%`,
                height: "100%",
                background: "var(--color-secondary)",
                transition: "width 320ms var(--ease-out-expo)",
              }}
            />
          </div>
        </div>
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            maxHeight: "60vh",
            overflowY: "auto",
          }}
        >
          {lessons.map((l) => {
            const active = l.id === lesson.id;
            const isComplete = completed.has(l.id);
            return (
              <li key={l.id}>
                <Link
                  href={lessonHref(l.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "var(--s-3) var(--s-4)",
                    borderTop: "1px solid var(--color-hairline)",
                    background: active
                      ? "var(--color-secondary-soft)"
                      : "transparent",
                    textDecoration: "none",
                    color: active
                      ? "var(--color-secondary-deep)"
                      : "var(--color-text)",
                    fontWeight: active ? 600 : 400,
                    fontSize: "var(--fs-body-sm)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      flexShrink: 0,
                      background: isComplete
                        ? "var(--color-success)"
                        : "var(--color-surface-2)",
                      color: "#fff",
                    }}
                  >
                    {isComplete && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span style={{ flex: 1 }}>{localize(l.title, locale)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main content */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
      >
        <h1
          style={{
            fontSize: "var(--fs-h3)",
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          {localize(lesson.title, locale)}
        </h1>

        {lesson.type === "video" &&
          (playbackUrl ? (
            playbackKind === "stream" ? (
              <div
                style={{
                  position: "relative",
                  aspectRatio: "16 / 9",
                  borderRadius: "var(--r-lg)",
                  overflow: "hidden",
                  background: "#000",
                }}
              >
                <iframe
                  src={playbackUrl}
                  title={localize(lesson.title, locale)}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    border: 0,
                  }}
                />
              </div>
            ) : mediaKind === "audio" ? (
              <audio controls src={playbackUrl} style={{ width: "100%" }} />
            ) : (
              <video
                controls
                src={playbackUrl}
                style={{
                  width: "100%",
                  borderRadius: "var(--r-lg)",
                  background: "#000",
                  aspectRatio: "16 / 9",
                }}
              />
            )
          ) : (
            <div
              style={{
                padding: "var(--s-8)",
                textAlign: "center",
                color: "var(--color-text-muted)",
                border: "1px dashed var(--color-border)",
                borderRadius: "var(--r-lg)",
              }}
            >
              Video processing…
            </div>
          ))}

        {lesson.type === "text" && lesson.body && (
          <div
            style={{
              fontSize: "var(--fs-body)",
              lineHeight: "var(--lh-body)",
              color: "var(--color-text)",
              whiteSpace: "pre-line",
            }}
          >
            {localize(lesson.body, locale)}
          </div>
        )}

        {lesson.resources.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            <h2
              style={{
                fontSize: "var(--fs-h5)",
                color: "var(--color-text-strong)",
              }}
            >
              {t("resources")}
            </h2>
            {lesson.resources.map((r, i) => (
              <a
                key={i}
                href={r.fileKey}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--r-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-brand-deep)",
                  fontSize: "var(--fs-body-sm)",
                  width: "fit-content",
                }}
              >
                {r.name}
              </a>
            ))}
          </div>
        )}

        {lesson.type === "quiz" && lesson.quiz && (
          <QuizRunner
            courseId={courseId}
            lessonId={lesson.id}
            passPercent={lesson.quiz.passPercent}
            questions={lesson.quiz.questions}
            locale={locale}
            enrolled={enrolled}
            onPassed={(certId) => {
              setCompleted((s) => new Set(s).add(lesson.id));
              if (certId) setCertificateId(certId);
            }}
          />
        )}

        {certificateId && (
          <Link
            href={`/academy/certificate/${certificateId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "var(--s-4)",
              borderRadius: "var(--r-lg)",
              background: "var(--color-brand-soft)",
              color: "var(--color-brand-deep)",
              fontWeight: 600,
              textDecoration: "none",
              width: "fit-content",
            }}
          >
            <Award size={18} /> {tc("title")}
          </Link>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-3)",
            flexWrap: "wrap",
            borderTop: "1px solid var(--color-border)",
            paddingTop: "var(--s-5)",
          }}
        >
          {enrolled &&
            lesson.type !== "quiz" &&
            (isDone ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--color-success)",
                  fontWeight: 600,
                }}
              >
                <Check size={16} /> {t("completed")}
              </span>
            ) : (
              <CtaButton
                onClick={complete}
                style={{
                  background: "var(--color-secondary)",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {t("markComplete")}
              </CtaButton>
            ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {prevId && (
              <CtaButton href={lessonHref(prevId)} variant="secondary">
                <ChevronLeft size={16} /> {t("previous")}
              </CtaButton>
            )}
            {nextId && (
              <CtaButton href={lessonHref(nextId)} variant="secondary">
                {t("next")} <ChevronRight size={16} />
              </CtaButton>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 880px) {
          .lesson-shell { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
