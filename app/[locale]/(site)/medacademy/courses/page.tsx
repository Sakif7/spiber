import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { CardGrid } from "@/components/ui/card-grid";
import { Link } from "@/i18n/navigation";
import { CourseCard } from "@/components/academy/course-card";
import { CourseFilters } from "@/components/academy/course-filters";
import { listCourses, type CourseSort } from "@/lib/repositories/courses.repo";
import { HERO } from "@/lib/hero-images";
import { toMinor } from "@/lib/money";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";
import type { CourseLevel } from "@/lib/schemas/academy";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const LEVELS = new Set(["beginner", "intermediate", "advanced"]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "academy.catalog" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/medacademy/courses",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function CoursesCatalog({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SP;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "academy" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const sp = await searchParams;
  const page = Math.max(1, parseInt(str(sp.page) ?? "1", 10) || 1);
  const levelRaw = str(sp.level);
  const minMajor = str(sp.min) ? Number(str(sp.min)) : undefined;
  const maxMajor = str(sp.max) ? Number(str(sp.max)) : undefined;

  let result: Awaited<ReturnType<typeof listCourses>> = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 12,
    pages: 1,
  };
  try {
    result = await listCourses({
      status: "published",
      search: str(sp.q),
      level:
        levelRaw && LEVELS.has(levelRaw)
          ? (levelRaw as CourseLevel)
          : undefined,
      minPriceMinor: minMajor != null ? toMinor(minMajor) : undefined,
      maxPriceMinor: maxMajor != null ? toMinor(maxMajor) : undefined,
      sort: (str(sp.sort) as CourseSort) ?? "newest",
      page,
    });
  } catch (e) {
    logger.warn("courses catalog load failed", e);
  }

  return (
    <>
      <PageHeader
        eyebrow={t("hub.title")}
        title={t("catalog.title")}
        description={t("catalog.lede")}
        image={HERO.academyHub}
        imageAlt={t("catalog.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("hub.title"), href: "/medacademy" },
          { label: t("catalog.title") },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container>
          <div
            className="academy-catalog"
            style={{
              display: "grid",
              gridTemplateColumns: "260px minmax(0, 1fr)",
              gap: "var(--s-8)",
              alignItems: "start",
            }}
          >
            <CourseFilters />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-6)",
              }}
            >
              <p
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--fs-body-sm)",
                }}
              >
                {t("catalog.results", { count: result.total })}
              </p>
              {result.items.length === 0 ? (
                <div
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--r-lg)",
                    padding: "var(--s-10)",
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {t("catalog.empty")}
                </div>
              ) : (
                <CardGrid columns={3}>
                  {result.items.map((c) => (
                    <CourseCard key={String(c._id)} course={c} locale={l} />
                  ))}
                </CardGrid>
              )}
              {result.pages > 1 && (
                <div
                  style={{ display: "flex", gap: 8, justifyContent: "center" }}
                >
                  {Array.from({ length: result.pages }).map((_, i) => {
                    const n = i + 1;
                    const q = new URLSearchParams();
                    if (str(sp.q)) q.set("q", str(sp.q)!);
                    if (levelRaw) q.set("level", levelRaw);
                    if (str(sp.min)) q.set("min", str(sp.min)!);
                    if (str(sp.max)) q.set("max", str(sp.max)!);
                    if (str(sp.sort)) q.set("sort", str(sp.sort)!);
                    if (n > 1) q.set("page", String(n));
                    return (
                      <Link
                        key={n}
                        href={`/medacademy/courses${q.toString() ? `?${q.toString()}` : ""}`}
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
            </div>
          </div>
        </Container>
      </section>
      <style>{`
        @media (max-width: 820px) {
          .academy-catalog { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
