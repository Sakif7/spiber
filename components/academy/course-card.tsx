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
  const summary = course.summary ? localize(course.summary, locale) : "";
  const desc = summary || t("course.lessons", { count: lessons });

  return (
    <Link href={`/academy/course/${course.slug}`} className="block h-full">
      <CardContainer
        containerClassName="py-0 w-full h-full"
        className="h-full w-full"
      >
        <CardBody className="group/card relative flex h-full w-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-shadow duration-300 hover:shadow-[0_24px_60px_-20px_rgba(230,107,38,0.32)]">
          <CardItem
            as="h3"
            translateZ="50"
            className="line-clamp-2 w-full text-[17px] leading-snug font-semibold text-[var(--color-text-strong)]"
          >
            {title}
          </CardItem>

          <CardItem translateZ="80" className="mt-4 w-full">
            <div className="relative aspect-[16/9] w-full overflow-hidden border border-[var(--color-hairline)] bg-[var(--color-surface-2)]">
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
              <span
                className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize backdrop-blur"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-surface) 90%, transparent)",
                  color: "var(--color-secondary-deep)",
                }}
              >
                {t(`levels.${course.level}`)}
              </span>
            </div>
          </CardItem>

          <CardItem
            as="p"
            translateZ="30"
            className="mt-5 line-clamp-2 w-full text-[13.5px] leading-relaxed text-[var(--color-text-muted)]"
          >
            {desc}
          </CardItem>

          <CardItem
            translateZ="40"
            className="mt-auto flex w-full items-center justify-between gap-3 pt-5"
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
