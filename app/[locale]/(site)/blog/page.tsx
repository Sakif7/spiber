import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { LiveSearch } from "@/components/ui/live-search";
import { Link } from "@/i18n/navigation";
import { PostCard } from "@/components/blog/post-card";
import {
  listPublishedPosts,
  type PublicPostListParams,
} from "@/lib/repositories/blog.repo";
import {
  listBlogCategories,
  getBlogCategoryBySlug,
} from "@/lib/repositories/blogTaxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SP;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const pageN = parseInt(str(sp.page) ?? "1", 10) || 1;
  const filtered = pageN > 1 || !!str(sp.q) || !!str(sp.category);
  const t = await getTranslations({ locale, namespace: "hubs.blog" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/blog",
    title: t("title"),
    description: t("description"),
    noindex: filtered,
  });
}

export default async function BlogIndex({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SP;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "blog" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const sp = await searchParams;
  const q = str(sp.q);
  const categorySlug = str(sp.category);
  const page = Math.max(1, parseInt(str(sp.page) ?? "1", 10) || 1);

  let categories: Awaited<ReturnType<typeof listBlogCategories>> = [];
  let result: Awaited<ReturnType<typeof listPublishedPosts>> = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 9,
    pages: 1,
  };
  try {
    categories = await listBlogCategories();
    const params2: PublicPostListParams = { search: q, page };
    if (categorySlug) {
      const cat = await getBlogCategoryBySlug(categorySlug);
      if (cat) params2.categoryId = String(cat._id);
    }
    result = await listPublishedPosts(params2);
  } catch (e) {
    logger.warn("blog index load failed", e);
  }

  const pill = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: "var(--r-pill)",
    border: "1px solid var(--color-border)",
    background: active ? "var(--color-secondary)" : "var(--color-surface)",
    color: active ? "#fff" : "var(--color-text-muted)",
    fontSize: "var(--fs-body-sm)",
    textDecoration: "none",
  });

  return (
    <>
      <PageHeader
        eyebrow={nav("blog")}
        title={t("title")}
        description={t("lede")}
        breadcrumbs={[{ label: nav("home"), href: "/" }, { label: t("title") }]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container style={{ display: "grid", gap: "var(--s-6)" }}>
          {/* Search + category filters */}
          <div
            style={{
              display: "flex",
              gap: "var(--s-4)",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/blog" style={pill(!categorySlug)}>
                {t("allCategories")}
              </Link>
              {categories.map((c) => (
                <Link
                  key={String(c._id)}
                  href={`/blog/category/${c.slug}`}
                  style={pill(false)}
                >
                  {localize(c.name, l)}
                </Link>
              ))}
            </div>
            <LiveSearch
              placeholder={t("searchPlaceholder")}
              ariaLabel={t("search")}
              size="sm"
              style={{ width: "min(320px, 100%)" }}
            />
          </div>

          {result.items.length === 0 ? (
            <ComingSoon />
          ) : (
            <>
              <p
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--fs-body-sm)",
                }}
              >
                {t("results", { count: result.total })}
              </p>
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
                    const params3 = new URLSearchParams();
                    if (q) params3.set("q", q);
                    if (categorySlug) params3.set("category", categorySlug);
                    if (n > 1) params3.set("page", String(n));
                    const qs = params3.toString();
                    return (
                      <Link
                        key={n}
                        href={`/blog${qs ? `?${qs}` : ""}`}
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
