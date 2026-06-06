import { useTranslations } from "next-intl";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { CatalogCard } from "@/components/ui/catalog-card";
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
  const tc = useTranslations("common");
  const title = localize(course.title, locale);
  const lessons = course.modules.reduce((s, m) => s + m.lessons.length, 0);

  return (
    <CatalogCard
      href={`/academy/course/${course.slug}`}
      image={course.thumbnail}
      imageAlt={title}
      placeholderLabel={title}
      placeholderTone="orange"
      topLabel={`${t(`levels.${course.level}`)} · ${t("course.lessons", {
        count: lessons,
      })}`}
      title={title}
      footerLeft={
        <strong
          style={{
            fontSize: "var(--fs-h5)",
            fontWeight: 700,
            color: "var(--color-secondary-deep)",
          }}
        >
          {course.priceMinor > 0
            ? formatBDT(course.priceMinor, locale)
            : t("course.free")}
        </strong>
      }
      action={tc("view")}
    />
  );
}
