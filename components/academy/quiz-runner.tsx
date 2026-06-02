"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { localize } from "@/lib/schemas/localized";
import { CtaButton } from "@/components/ui/cta-button";
import type { Locale } from "@/i18n/routing";

type L = { en: string; bn?: string };
export type QuizQuestionView = {
  id: string;
  prompt: L;
  options: { id: string; text: L }[];
};

export function QuizRunner({
  courseId,
  lessonId,
  passPercent,
  questions,
  locale,
  enrolled,
  onPassed,
}: {
  courseId: string;
  lessonId: string;
  passPercent: number;
  questions: QuizQuestionView[];
  locale: Locale;
  enrolled: boolean;
  onPassed: (certificateId?: string | null) => void;
}) {
  const t = useTranslations("academy.quiz");
  const tp = useTranslations("academy.player");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    scorePercent: number;
    passed: boolean;
  } | null>(null);

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/academy/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        lessonId,
        answers: Object.entries(answers).map(([questionId, optionId]) => ({
          questionId,
          optionId,
        })),
      }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      setResult({
        scorePercent: json.data.scorePercent,
        passed: json.data.passed,
      });
      if (json.data.passed) onPassed(json.data.certificateId);
    }
  }

  const allAnswered = questions.every((q) => answers[q.id]);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
    >
      <p
        style={{
          fontSize: "var(--fs-caption)",
          color: "var(--color-text-muted)",
        }}
      >
        {t("passMark", { percent: passPercent })}
      </p>
      {questions.map((q, qi) => (
        <fieldset
          key={q.id}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-md)",
            padding: "var(--s-4)",
            display: "grid",
            gap: "var(--s-3)",
          }}
        >
          <legend
            style={{
              fontWeight: 600,
              color: "var(--color-text-strong)",
              padding: "0 6px",
            }}
          >
            {qi + 1}. {localize(q.prompt, locale)}
          </legend>
          {q.options.map((o) => (
            <label
              key={o.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: "var(--fs-body-sm)",
              }}
            >
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === o.id}
                disabled={!!result?.passed}
                onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
              />
              {localize(o.text, locale)}
            </label>
          ))}
        </fieldset>
      ))}

      {result && (
        <div
          style={{
            padding: "var(--s-4)",
            borderRadius: "var(--r-md)",
            background: result.passed
              ? "var(--color-brand-soft)"
              : "var(--color-secondary-soft)",
            color: result.passed
              ? "var(--color-brand-deep)"
              : "var(--color-secondary-deep)",
            fontWeight: 600,
          }}
        >
          {t("score", { score: result.scorePercent })} ·{" "}
          {result.passed ? t("passed") : t("failed")}
        </div>
      )}

      {!enrolled ? (
        <p
          style={{ color: "var(--color-text-muted)", fontSize: "var(--fs-sm)" }}
        >
          {t("submit")} —{" "}
          <span style={{ color: "var(--color-secondary-deep)" }}>
            {tp("enrollToContinue")}
          </span>
        </p>
      ) : result?.passed ? null : (
        <div>
          <CtaButton
            onClick={submit}
            style={{
              background: "var(--color-secondary)",
              opacity: !allAnswered || busy ? 0.6 : 1,
            }}
          >
            {busy ? t("submitting") : result ? t("retry") : t("submit")}
          </CtaButton>
        </div>
      )}
    </div>
  );
}
