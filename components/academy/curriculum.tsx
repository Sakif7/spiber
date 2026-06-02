"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  PlayCircle,
  FileText,
  HelpCircle,
  Paperclip,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";
import type { LessonType } from "@/lib/schemas/academy";

type L = { en: string; bn?: string };
export type CurriculumModule = {
  id: string;
  title: L;
  lessons: { id: string; title: L; type: LessonType; isFreePreview: boolean }[];
};

const ICON: Record<LessonType, LucideIcon> = {
  video: PlayCircle,
  text: FileText,
  quiz: HelpCircle,
  resource: Paperclip,
};

export function Curriculum({
  modules,
  locale,
  enrolled,
  slug,
}: {
  modules: CurriculumModule[];
  locale: Locale;
  enrolled: boolean;
  slug: string;
}) {
  const t = useTranslations("academy.course");

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
    >
      {modules.map((m, mi) => (
        <div
          key={m.id}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-lg)",
            background: "var(--color-surface)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "var(--s-4) var(--s-5)",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-surface-2)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-caption)",
                color: "var(--color-text-subtle)",
                marginRight: 10,
              }}
            >
              {String(mi + 1).padStart(2, "0")}
            </span>
            <strong style={{ color: "var(--color-text-strong)" }}>
              {localize(m.title, locale)}
            </strong>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {m.lessons.map((l) => {
              const Icon = ICON[l.type];
              const accessible = enrolled || l.isFreePreview;
              const inner = (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--s-3)",
                    padding: "var(--s-3) var(--s-5)",
                    borderTop: "1px solid var(--color-hairline)",
                    color: accessible
                      ? "var(--color-text)"
                      : "var(--color-text-subtle)",
                  }}
                >
                  <Icon
                    size={17}
                    style={{
                      color: accessible
                        ? "var(--color-secondary-deep)"
                        : "var(--color-text-subtle)",
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <span style={{ fontSize: "var(--fs-body-sm)", flex: 1 }}>
                    {localize(l.title, locale)}
                  </span>
                  {l.isFreePreview && !enrolled && (
                    <span
                      style={{
                        fontSize: "var(--fs-caption)",
                        fontWeight: 600,
                        color: "var(--color-secondary-deep)",
                      }}
                    >
                      {t("preview")}
                    </span>
                  )}
                  {!accessible && <Lock size={14} aria-label={t("locked")} />}
                </div>
              );
              return (
                <li key={l.id}>
                  {accessible ? (
                    <Link
                      href={`/academy/course/${slug}/learn/${l.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
