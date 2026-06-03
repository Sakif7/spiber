import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import { Placeholder } from "@/components/ui/placeholder";
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";
import type { Locale } from "@/i18n/routing";
import type { Lean } from "@/lib/models/_shared";
import type { IBlogPost } from "@/lib/models/blogPost";

export function PostCard({
  post,
  locale,
}: {
  post: Lean<IBlogPost>;
  locale: Locale;
}) {
  const t = useTranslations("blog");
  const tc = useTranslations("common");
  const title = localize(post.title, locale);
  const excerpt = post.excerpt ? localize(post.excerpt, locale) : "";
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(
        locale === "bn" ? "bn-BD" : "en-GB",
        { year: "numeric", month: "short", day: "numeric" },
      )
    : "";

  return (
    <Link href={`/blog/${post.slug}`} className="block h-full">
      <CardContainer
        containerClassName="py-0 w-full h-full"
        className="h-full w-full"
      >
        <CardBody className="group/card relative flex h-full w-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-shadow duration-300 hover:shadow-[0_24px_60px_-20px_rgba(14,139,134,0.30)]">
          <CardItem
            as="h3"
            translateZ="50"
            className="line-clamp-2 w-full text-[18px] leading-snug font-semibold text-[var(--color-text-strong)]"
          >
            {title}
          </CardItem>

          <CardItem translateZ="80" className="mt-4 w-full">
            <div className="relative aspect-[16/9] w-full overflow-hidden border border-[var(--color-hairline)] bg-[var(--color-surface-2)]">
              {post.coverImage ? (
                <Image
                  src={post.coverImage}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover/card:scale-[1.05]"
                />
              ) : (
                <Placeholder
                  label={title}
                  tone="teal"
                  style={{ position: "absolute", inset: 0 }}
                />
              )}
            </div>
          </CardItem>

          {excerpt && (
            <CardItem
              as="p"
              translateZ="30"
              className="mt-5 line-clamp-2 w-full text-[13.5px] leading-relaxed text-[var(--color-text-muted)]"
            >
              {excerpt}
            </CardItem>
          )}

          <CardItem
            translateZ="40"
            className="mt-auto flex w-full items-center justify-between gap-3 pt-5"
          >
            <span className="text-[var(--color-text-subtle)] text-[var(--fs-caption)]">
              {date}
              {date && post.readingTimeMin ? " · " : ""}
              {post.readingTimeMin
                ? t("readingTime", { min: post.readingTimeMin })
                : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-brand-deep)] transition-colors group-hover/card:border-[var(--color-brand)] group-hover/card:bg-[var(--color-brand)] group-hover/card:text-white">
              {tc("read")}
              <span aria-hidden>→</span>
            </span>
          </CardItem>
        </CardBody>
      </CardContainer>
    </Link>
  );
}
