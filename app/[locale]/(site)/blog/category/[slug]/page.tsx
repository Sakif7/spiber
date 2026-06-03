import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CardGrid } from "@/components/ui/card-grid";
import { Link } from "@/i18n/navigation";
import { PostCard } from "@/components/blog/post-card";
import { listPublishedPosts } from "@/lib/repositories/blog.repo";
import { getBlogCategoryBySlug } from "@/lib/repositories/blogTaxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type SP = Promise<{ page?: string }>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const cat = await getBlogCategoryBySlug(slug).catch(() => null);
  if (!cat) return {};
  return pageMetadata({
    locale: locale as Locale,
    path: `/blog/category/${slug}`,
    title: localize(cat.name, locale as Locale),
  });
}

export default async function BlogCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: SP;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "blog" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const cat = await getBlogCategoryBySlug(slug);
  if (!cat) notFound();

  const page = Math.max(1, parseInt((await searchParams).page ?? "1", 10) || 1);
  const result = await listPublishedPosts({
    categoryId: String(cat._id),
    page,
  });

  return (
    <>
      <PageHeader
        eyebrow={t("category")}
        title={localize(cat.name, l)}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("blog"), href: "/blog" },
          { label: localize(cat.name, l) },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container style={{ display: "grid", gap: "var(--s-6)" }}>
          {result.items.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>{t("empty")}</p>
          ) : (
            <>
              <CardGrid columns={3}>
                {result.items.map((p) => (
                  <PostCard key={String(p._id)} post={p} locale={l} />
                ))}
              </CardGrid>
              {result.pages > 1 && (
                <div
                  style={{ display: "flex", gap: 8, justifyContent: "center" }}
                >
                  {Array.from({ length: result.pages }).map((_, i) => {
                    const n = i + 1;
                    return (
                      <Link
                        key={n}
                        href={`/blog/category/${slug}${n > 1 ? `?page=${n}` : ""}`}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "var(--r-sm)",
                          border: "1px solid var(--color-border)",
                          background:
                            n === result.page
                              ? "var(--color-secondary)"
                              : "var(--color-surface)",
                          color:
                            n === result.page
                              ? "#fff"
                              : "var(--color-text-muted)",
                          fontWeight: 600,
                          fontSize: "var(--fs-sm)",
                        }}
                      >
                        {n}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Container>
      </section>
    </>
  );
}
