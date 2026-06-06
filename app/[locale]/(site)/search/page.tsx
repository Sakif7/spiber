import { setRequestLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CardGrid } from "@/components/ui/card-grid";
import { Arrow } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { CatalogSearch } from "@/components/search/catalog-search";
import { ProductCard } from "@/components/shop/product-card";
import { CourseCard } from "@/components/academy/course-card";
import { SoftwareCard } from "@/components/systems/software-card";
import { PostCard } from "@/components/blog/post-card";
import { searchAll, totalResults } from "@/lib/services/search.service";
import { listBrands } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";
import type { SearchGroupKey } from "@/lib/search/dto";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Where each "View all" link points (existing list pages; q where supported).
function viewAllHref(group: SearchGroupKey, q: string): string {
  const e = encodeURIComponent(q);
  switch (group) {
    case "instruments":
      return "/instruments";
    case "marketplace":
      return `/marketplace/search?q=${e}`;
    case "academy":
      return `/academy/courses?q=${e}`;
    case "systems":
      return "/systems/products";
    case "blog":
      return `/blog?q=${e}`;
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SP;
}) {
  const { locale } = await params;
  const q = str((await searchParams).q)?.trim();
  const t = await getTranslations({ locale, namespace: "search" });
  const base = pageMetadata({
    locale: locale as Locale,
    path: q ? `/search?q=${encodeURIComponent(q)}` : "/search",
    title: q ? t("page.title", { query: q }) : t("page.titleEmpty"),
    description: t("page.ledeEmpty"),
  });
  // Query-string result pages should not be indexed.
  return { ...base, robots: { index: false, follow: true } };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SP;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "search" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const q = (str((await searchParams).q) ?? "").trim();
  const hasQuery = q.length >= 2;

  const results = hasQuery ? await searchAll(q, { perGroup: 12 }) : null;
  const total = results ? totalResults(results) : 0;
  // Brand labels for the product result cards.
  const brandList = hasQuery ? await listBrands().catch(() => []) : [];
  const brandNameById = new Map(
    brandList.map((b) => [String(b._id), localize(b.name, l)]),
  );

  return (
    <>
      <PageHeader
        eyebrow={t("page.eyebrow")}
        title={hasQuery ? t("page.title", { query: q }) : t("page.titleEmpty")}
        description={
          hasQuery ? t("page.lede", { count: total }) : t("page.ledeEmpty")
        }
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("page.eyebrow") },
        ]}
      />

      <section style={{ paddingBlock: "clamp(32px, 5vw, 72px)" }}>
        <Container
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-12)",
          }}
        >
          <div style={{ maxWidth: 600, width: "100%" }}>
            <CatalogSearch defaultValue={q} autoFocus={!hasQuery} />
          </div>

          {!hasQuery ? (
            <EmptyState
              title={t("page.promptTitle")}
              body={t("page.promptBody")}
            />
          ) : total === 0 ? (
            <EmptyState
              title={t("page.noResultsTitle", { query: q })}
              body={t("page.noResultsBody")}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-16)",
              }}
            >
              {results!.products.items.length > 0 && (
                <ResultSection
                  title={t("groups.instruments")}
                  count={results!.products.total}
                  href={viewAllHref("instruments", q)}
                  viewAll={t("page.viewAll")}
                >
                  <CardGrid columns={3}>
                    {results!.products.items.map((p) => (
                      <ProductCard
                        key={String(p._id)}
                        product={p}
                        locale={l}
                        mode="instruments"
                        brandName={
                          p.brandId
                            ? brandNameById.get(String(p.brandId))
                            : undefined
                        }
                      />
                    ))}
                  </CardGrid>
                </ResultSection>
              )}

              {results!.marketplace.items.length > 0 && (
                <ResultSection
                  title={t("groups.marketplace")}
                  count={results!.marketplace.total}
                  href={viewAllHref("marketplace", q)}
                  viewAll={t("page.viewAll")}
                >
                  <CardGrid columns={3}>
                    {results!.marketplace.items.map((p) => (
                      <ProductCard
                        key={String(p._id)}
                        product={p}
                        locale={l}
                        mode="marketplace"
                        brandName={
                          p.brandId
                            ? brandNameById.get(String(p.brandId))
                            : undefined
                        }
                      />
                    ))}
                  </CardGrid>
                </ResultSection>
              )}

              {results!.courses.items.length > 0 && (
                <ResultSection
                  title={t("groups.academy")}
                  count={results!.courses.total}
                  href={viewAllHref("academy", q)}
                  viewAll={t("page.viewAll")}
                >
                  <CardGrid columns={3}>
                    {results!.courses.items.map((c) => (
                      <CourseCard key={String(c._id)} course={c} locale={l} />
                    ))}
                  </CardGrid>
                </ResultSection>
              )}

              {results!.software.items.length > 0 && (
                <ResultSection
                  title={t("groups.systems")}
                  count={results!.software.total}
                  href={viewAllHref("systems", q)}
                  viewAll={t("page.viewAll")}
                >
                  <CardGrid columns={3}>
                    {results!.software.items.map((s) => (
                      <SoftwareCard
                        key={String(s._id)}
                        product={s}
                        locale={l}
                      />
                    ))}
                  </CardGrid>
                </ResultSection>
              )}

              {results!.posts.items.length > 0 && (
                <ResultSection
                  title={t("groups.blog")}
                  count={results!.posts.total}
                  href={viewAllHref("blog", q)}
                  viewAll={t("page.viewAll")}
                >
                  <CardGrid columns={3}>
                    {results!.posts.items.map((post) => (
                      <PostCard key={String(post._id)} post={post} locale={l} />
                    ))}
                  </CardGrid>
                </ResultSection>
              )}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}

function ResultSection({
  title,
  count,
  href,
  viewAll,
  children,
}: {
  title: string;
  count: number;
  href: string;
  viewAll: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "var(--s-3)",
        }}
      >
        <h2
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            margin: 0,
            fontSize: "var(--fs-h3)",
            letterSpacing: "var(--tracking-heading)",
            color: "var(--color-text-strong)",
          }}
        >
          {title}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 400,
              color: "var(--brand-teal)",
            }}
          >
            {count}
          </span>
        </h2>
        <Link
          href={href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            fontSize: "var(--fs-body-sm)",
            fontWeight: 500,
            color: "var(--color-text-muted)",
            textDecoration: "none",
          }}
        >
          {viewAll}
          <Arrow size={13} />
        </Link>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-xl)",
        background: "var(--color-surface)",
        padding: "clamp(36px, 6vw, 72px) var(--s-8)",
        textAlign: "center",
        maxWidth: 620,
        marginInline: "auto",
      }}
    >
      <h2
        style={{
          margin: "0 0 8px",
          fontSize: "var(--fs-h4)",
          color: "var(--color-text-strong)",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: "var(--fs-body)",
          lineHeight: "var(--lh-body)",
          color: "var(--color-text-muted)",
        }}
      >
        {body}
      </p>
    </div>
  );
}
