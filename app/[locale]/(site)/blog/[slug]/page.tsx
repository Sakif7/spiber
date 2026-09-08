import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/site-breadcrumb";
import { CardGrid } from "@/components/ui/card-grid";
import { JsonLd } from "@/components/ui/json-ld";
import { Link } from "@/i18n/navigation";
import { PostBody } from "@/components/blog/post-body";
import { ShareButtons } from "@/components/blog/share-buttons";
import { PostCard } from "@/components/blog/post-card";
import {
  getPublishedPostBySlug,
  listRelatedPosts,
  incrementViewCount,
} from "@/lib/repositories/blog.repo";
import { getBlogTagsByIds } from "@/lib/repositories/blogTaxonomy.repo";
import { findUserById } from "@/lib/repositories/users.repo";
import { localize } from "@/lib/schemas/localized";
import { bcp47 } from "@/lib/i18n/intl-locale";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { siteConfig } from "@/lib/site-config";
import { localePath } from "@/lib/i18n/intl-locale";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const l = locale as Locale;
  const post = await getPublishedPostBySlug(slug).catch(() => null);
  if (!post) return {};
  const title = post.seo?.metaTitle
    ? localize(post.seo.metaTitle, l)
    : localize(post.title, l);
  const description = post.seo?.metaDescription
    ? localize(post.seo.metaDescription, l)
    : post.excerpt
      ? localize(post.excerpt, l)
      : undefined;
  const ogImage = post.seo?.ogImage || post.coverImage;
  const meta = pageMetadata({
    locale: l,
    path: `/blog/${slug}`,
    title,
    description,
  });
  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      type: "article",
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const localeBase = siteConfig.url + localePath(l, "/").replace(/\/$/, "");
  const t = await getTranslations({ locale, namespace: "blog" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  await incrementViewCount(String(post._id)).catch(() => {});

  const [author, tags, related] = await Promise.all([
    findUserById(String(post.authorId)).catch(() => null),
    getBlogTagsByIds(post.tagIds as string[]).catch(() => []),
    listRelatedPosts(
      post.categoryId ? String(post.categoryId) : null,
      String(post._id),
    ).catch(() => []),
  ]);

  const title = localize(post.title, l);
  const authorName =
    post.authorName?.trim() || author?.name || siteConfig.brand;
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(bcp47(l), {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: post.excerpt ? localize(post.excerpt, l) : undefined,
    image: post.coverImage ? [post.coverImage] : undefined,
    datePublished: post.publishedAt
      ? new Date(post.publishedAt).toISOString()
      : undefined,
    dateModified: post.updatedAt
      ? new Date(post.updatedAt).toISOString()
      : undefined,
    author: { "@type": "Person", name: authorName },
    publisher: { "@type": "Organization", name: siteConfig.brand },
  };

  return (
    <article style={{ paddingBlock: "clamp(32px, 4vw, 64px)" }}>
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: nav("home"), url: `${localeBase}` },
          { name: nav("blog"), url: `${localeBase}/blog` },
          { name: title, url: `${localeBase}/blog/${slug}` },
        ])}
      />
      <Container style={{ maxWidth: 760, display: "grid", gap: "var(--s-6)" }}>
        <Breadcrumb
          items={[
            { label: nav("home"), href: "/" },
            { label: nav("blog"), href: "/blog" },
            { label: title },
          ]}
        />

        <header style={{ display: "grid", gap: "var(--s-4)" }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-h1)",
              lineHeight: "var(--lh-heading)",
              color: "var(--color-text-strong)",
              margin: 0,
            }}
          >
            {title}
          </h1>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              color: "var(--color-text-muted)",
              fontSize: "var(--fs-body-sm)",
            }}
          >
            <span>{t("by", { name: authorName })}</span>
            {date && <span aria-hidden>·</span>}
            {date && <span>{date}</span>}
            {post.readingTimeMin ? <span aria-hidden>·</span> : null}
            {post.readingTimeMin ? (
              <span>{t("readingTime", { min: post.readingTimeMin })}</span>
            ) : null}
          </div>
        </header>

        {post.coverImage && (
          <div
            style={{
              position: "relative",
              aspectRatio: "16 / 9",
              borderRadius: "var(--r-xl)",
              overflow: "hidden",
              background: "var(--color-surface-2)",
            }}
          >
            <Image
              src={post.coverImage}
              alt={title}
              fill
              sizes="(max-width: 800px) 100vw, 760px"
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
        )}

        <PostBody html={localize(post.body, l)} />

        {tags.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {tags.map((tag) => (
              <Link
                key={String(tag._id)}
                href={`/blog/tag/${tag.slug}`}
                style={{
                  padding: "4px 12px",
                  borderRadius: "var(--r-pill)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-muted)",
                  fontSize: "var(--fs-body-sm)",
                  textDecoration: "none",
                }}
              >
                #{localize(tag.name, l)}
              </Link>
            ))}
          </div>
        )}

        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            paddingTop: "var(--s-5)",
          }}
        >
          <ShareButtons title={title} />
        </div>
      </Container>

      {related.length > 0 && (
        <Container style={{ marginTop: "clamp(40px, 6vw, 80px)" }}>
          <h2
            style={{
              fontSize: "var(--fs-h4)",
              color: "var(--color-text-strong)",
              marginBottom: "var(--s-5)",
            }}
          >
            {t("related")}
          </h2>
          <CardGrid columns={3}>
            {related.map((p) => (
              <PostCard key={String(p._id)} post={p} locale={l} />
            ))}
          </CardGrid>
        </Container>
      )}
    </article>
  );
}
