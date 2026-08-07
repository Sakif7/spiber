import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { CardGrid } from "@/components/ui/card-grid";
import { CtaButton } from "@/components/ui/cta-button";
import { CourseCard } from "@/components/academy/course-card";
import { listCourses } from "@/lib/repositories/courses.repo";
import { HERO } from "@/lib/hero-images";
import { pageMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "academy.hub" });
  return pageMetadata({
    locale: locale as Locale,
    path: "/medacademy",
    title: t("title"),
    description: t("lede"),
  });
}

export default async function AcademyHub({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "academy" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const hub = await getTranslations({ locale, namespace: "hubs.academy" });

  let courses: Awaited<ReturnType<typeof listCourses>>["items"] = [];
  try {
    const res = await listCourses({ status: "published", pageSize: 8 });
    courses = res.items;
  } catch (e) {
    logger.warn("academy hub data load failed", e);
  }

  return (
    <>
      <PageHeader
        eyebrow={hub("eyebrow")}
        title={t("hub.title")}
        description={t("hub.lede")}
        image={HERO.academyHub}
        imageAlt={t("hub.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("hub.title") },
        ]}
      />
      {courses.length === 0 ? (
        <ComingSoon />
      ) : (
        <section style={{ paddingBlock: "clamp(48px, 6vw, 96px)" }}>
          <Container
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-8)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--s-4)",
                flexWrap: "wrap",
              }}
            >
              <h2
                style={{
                  fontSize: "var(--fs-h3)",
                  color: "var(--color-text-strong)",
                }}
              >
                {t("hub.featured")}
              </h2>
              <CtaButton href="/medacademy/courses" variant="ghost">
                {t("hub.browseAll")}
              </CtaButton>
            </div>
            <CardGrid columns={3}>
              {courses.map((c) => (
                <CourseCard key={String(c._id)} course={c} locale={l} />
              ))}
            </CardGrid>
          </Container>
        </section>
      )}
    </>
  );
}
