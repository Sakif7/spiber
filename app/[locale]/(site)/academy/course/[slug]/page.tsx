import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { CardGrid } from "@/components/ui/card-grid";
import { JsonLd } from "@/components/ui/json-ld";
import { RecentlyViewed } from "@/components/ui/recently-viewed";
import { Curriculum } from "@/components/academy/curriculum";
import { CourseCard } from "@/components/academy/course-card";
import { EnrollButton } from "@/components/academy/enroll-button";
import {
  getCourseBySlug,
  flattenLessons,
  listRelatedCourses,
} from "@/lib/repositories/courses.repo";
import { hasCourseAccess } from "@/lib/repositories/enrollments.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { localize } from "@/lib/schemas/localized";
import { formatBDT, fromMinor } from "@/lib/money";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { siteConfig } from "@/lib/site-config";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const course = await getCourseBySlug(slug).catch(() => null);
  if (!course) return {};
  return pageMetadata({
    locale: locale as Locale,
    path: `/academy/course/${slug}`,
    title: localize(course.title, locale as Locale),
    description: course.summary
      ? localize(course.summary, locale as Locale)
      : undefined,
    image: course.thumbnail,
  });
}

export default async function CourseDetail({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "academy" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const course = await getCourseBySlug(slug);
  if (!course || course.status !== "published") notFound();

  const user = await getSessionUser();
  const enrolled = user
    ? await hasCourseAccess(user.sub, String(course._id))
    : false;
  const lessons = flattenLessons(course);
  const firstLessonId = lessons[0]?.id;
  const title = localize(course.title, l);
  const related = await listRelatedCourses(String(course._id), {
    level: course.level,
  }).catch(() => []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: title,
    description: course.summary ? localize(course.summary, l) : undefined,
    provider: { "@type": "Organization", name: siteConfig.brand },
    ...(course.priceMinor > 0
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "BDT",
            price: fromMinor(course.priceMinor).toFixed(2),
          },
        }
      : {}),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: nav("home"), url: `${siteConfig.url}/${l}` },
          { name: nav("academy"), url: `${siteConfig.url}/${l}/academy` },
          { name: title, url: `${siteConfig.url}/${l}/academy/course/${slug}` },
        ])}
      />
      <section
        style={{
          background:
            "linear-gradient(160deg, var(--orange-50), var(--color-surface) 60%)",
          paddingBlock: "clamp(48px, 7vw, 96px)",
        }}
      >
        <Container>
          <div
            className="course-hero"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)",
              gap: "var(--s-10)",
              alignItems: "start",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-5)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-caption)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-eyebrow)",
                  color: "var(--color-secondary-deep)",
                }}
              >
                {t(`levels.${course.level}`)} ·{" "}
                {t("course.lessons", { count: lessons.length })}
              </span>
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
              {course.summary && (
                <p
                  style={{
                    fontSize: "var(--fs-body-lg)",
                    color: "var(--color-text-muted)",
                    maxWidth: "60ch",
                    margin: 0,
                  }}
                >
                  {localize(course.summary, l)}
                </p>
              )}
            </div>

            <aside
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-xl)",
                background: "var(--color-surface)",
                padding: "var(--s-6)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-4)",
                boxShadow: "var(--shadow-md)",
                position: "sticky",
                top: 96,
              }}
            >
              <div
                style={{
                  fontSize: "var(--fs-h2)",
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  color: "var(--color-text-strong)",
                }}
              >
                {course.priceMinor > 0
                  ? formatBDT(course.priceMinor, l)
                  : t("course.free")}
              </div>
              <EnrollButton
                courseId={String(course._id)}
                slug={course.slug}
                enrolled={enrolled}
                firstLessonId={firstLessonId}
              />
            </aside>
          </div>
        </Container>
      </section>

      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-8)",
            maxWidth: 860,
          }}
        >
          {course.description && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-4)",
              }}
            >
              <h2
                style={{
                  fontSize: "var(--fs-h3)",
                  color: "var(--color-text-strong)",
                }}
              >
                {t("course.overview")}
              </h2>
              <p
                style={{
                  fontSize: "var(--fs-body)",
                  lineHeight: "var(--lh-body)",
                  color: "var(--color-text)",
                  whiteSpace: "pre-line",
                }}
              >
                {localize(course.description, l)}
              </p>
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-4)",
            }}
          >
            <h2
              style={{
                fontSize: "var(--fs-h3)",
                color: "var(--color-text-strong)",
              }}
            >
              {t("course.curriculum")}
            </h2>
            <Curriculum
              modules={course.modules.map((m) => ({
                id: m.id,
                title: m.title,
                lessons: m.lessons.map((le) => ({
                  id: le.id,
                  title: le.title,
                  type: le.type,
                  isFreePreview: Boolean(le.isFreePreview),
                })),
              }))}
              locale={l}
              enrolled={enrolled}
              slug={course.slug}
            />
          </div>
        </Container>
      </section>

      {related.length > 0 && (
        <section
          style={{
            background: "var(--color-surface-2)",
            paddingBlock: "clamp(40px, 5vw, 72px)",
          }}
        >
          <Container style={{ display: "grid", gap: "var(--s-5)" }}>
            <h2
              style={{
                fontSize: "var(--fs-h4)",
                color: "var(--color-text-strong)",
              }}
            >
              {t("course.more")}
            </h2>
            <CardGrid columns={3}>
              {related.map((c) => (
                <CourseCard key={String(c._id)} course={c} locale={l} />
              ))}
            </CardGrid>
          </Container>
        </section>
      )}

      <Container style={{ paddingBlock: "clamp(32px, 4vw, 64px)" }}>
        <RecentlyViewed
          title={t("course.recentlyViewed")}
          current={{
            href: `/academy/course/${course.slug}`,
            name: title,
            image: course.thumbnail,
            meta:
              course.priceMinor > 0
                ? formatBDT(course.priceMinor, l)
                : t("course.free"),
          }}
        />
      </Container>

      <style>{`
        @media (max-width: 820px) {
          .course-hero { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
