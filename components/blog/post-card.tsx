import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import { Placeholder } from "@/components/ui/placeholder";
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
  const title = localize(post.title, locale);
  const excerpt = post.excerpt ? localize(post.excerpt, locale) : "";
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(
        locale === "bn" ? "bn-BD" : "en-GB",
        { year: "numeric", month: "short", day: "numeric" },
      )
    : "";

  return (
    <Link
      href={`/blog/${post.slug}`}
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
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <Placeholder
            label={title}
            tone="teal"
            style={{ position: "absolute", inset: 0 }}
          />
        )}
      </div>
      <div
        style={{
          padding: "var(--s-4)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
        }}
      >
        <h3
          style={{
            fontSize: "var(--fs-body-lg)",
            fontWeight: 600,
            color: "var(--color-text-strong)",
            lineHeight: 1.3,
          }}
        >
          {title}
        </h3>
        {excerpt && (
          <p
            style={{
              fontSize: "var(--fs-body-sm)",
              color: "var(--color-text-muted)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {excerpt}
          </p>
        )}
        <span
          style={{
            marginTop: "auto",
            fontSize: "var(--fs-caption)",
            color: "var(--color-text-subtle)",
          }}
        >
          {date}
          {date && post.readingTimeMin ? " · " : ""}
          {post.readingTimeMin
            ? t("readingTime", { min: post.readingTimeMin })
            : ""}
        </span>
      </div>
    </Link>
  );
}
