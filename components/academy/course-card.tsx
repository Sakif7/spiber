import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { Placeholder } from "@/components/ui/placeholder";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";
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
    <Link href={`/academy/course/${course.slug}`} className="block h-full">
      <CardContainer
        containerClassName="py-0 w-full h-full"
        className="h-full w-full"
      >
        <CardBody className="group/card relative flex h-full w-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow duration-300 hover:shadow-[0_24px_60px_-20px_rgba(230,107,38,0.32)]">
          <CardItem translateZ="70" className="w-full">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-2)]">
              {course.thumbnail ? (
                <Image
                  src={course.thumbnail}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover/card:scale-[1.05]"
                />
              ) : (
                <Placeholder
                  label={title}
                  tone="orange"
                  style={{ position: "absolute", inset: 0 }}
                />
              )}
            </div>
          </CardItem>

          <CardItem
            as="span"
            translateZ="30"
            className="mt-4 w-full font-medium text-[var(--color-text-muted)] text-[var(--fs-caption)] capitalize"
          >
            {t(`levels.${course.level}`)} ·{" "}
            {t("course.lessons", { count: lessons })}
          </CardItem>

          <CardItem
            as="h3"
            translateZ="40"
            className="mt-1 line-clamp-2 w-full text-[15px] leading-snug font-semibold text-[var(--color-text-strong)]"
          >
            {title}
          </CardItem>

          <CardItem
            translateZ="40"
            className="mt-auto flex w-full items-center justify-between gap-3 pt-4"
          >
            <strong className="font-bold text-[var(--color-secondary-deep)] text-[var(--fs-h5)]">
              {course.priceMinor > 0
                ? formatBDT(course.priceMinor, locale)
                : t("course.free")}
            </strong>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-secondary-deep)] transition-colors group-hover/card:border-[var(--color-secondary)] group-hover/card:bg-[var(--color-secondary)] group-hover/card:text-white">
              {tc("view")}
              <span aria-hidden>→</span>
            </span>
          </CardItem>
        </CardBody>
      </CardContainer>
    </Link>
  );
}
