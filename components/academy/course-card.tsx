import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { Placeholder } from "@/components/ui/placeholder";
import type { Locale } from "@/i18n/routing";
import type { Lean } from "@/lib/models/_shared";
import type { ICourse } from "@/lib/models/course";

export function CourseCard({
  course,
  locale,
}: {
  course: Lean<ICourse>;
  locale: Locale;
}) {
  const t = useTranslations("academy");
  const title = localize(course.title, locale);
  const lessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);

  return (
    <Link
      href={`/academy/course/${course.slug}`}
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        background: "var(--color-surface)",
        transition:
          "box-shadow 220ms var(--ease-out-expo), transform 220ms var(--ease-out-expo)",
      }}
    >
      <div
        style={{
          aspectRatio: "16 / 9",
          position: "relative",
          background: "var(--color-surface-2)",
        }}
      >
        {course.thumbnail ? (
          <Image
            src={course.thumbnail}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <Placeholder
            label={title}
            tone="orange"
            style={{ position: "absolute", inset: 0 }}
          />
        )}
        <span
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            padding: "4px 10px",
            borderRadius: "var(--r-pill)",
            background:
              "color-mix(in srgb, var(--color-surface) 88%, transparent)",
            fontSize: "var(--fs-caption)",
            fontWeight: 600,
            textTransform: "capitalize",
            color: "var(--color-secondary-deep)",
          }}
        >
          {t(`levels.${course.level}`)}
        </span>
      </div>
      <div
        style={{
          padding: "var(--s-4)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <h3
          style={{
            fontSize: "var(--fs-body)",
            fontWeight: 600,
            color: "var(--color-text-strong)",
            lineHeight: 1.3,
          }}
        >
          {title}
        </h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--s-3)",
          }}
        >
          <span
            style={{
              fontSize: "var(--fs-caption)",
              color: "var(--color-text-muted)",
            }}
          >
            {t("course.lessons", { count: lessons })}
          </span>
          <strong
            style={{ color: "var(--color-secondary-deep)", fontWeight: 700 }}
          >
            {course.priceMinor > 0
              ? formatBDT(course.priceMinor, locale)
              : t("course.free")}
          </strong>
        </div>
      </div>
    </Link>
  );
}
