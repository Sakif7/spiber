import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { LiveSearch } from "@/components/ui/live-search";
import { Reveal } from "@/components/ui/reveal";
import { Arrow } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { MapPin, Briefcase } from "lucide-react";
import { listOpenJobs } from "@/lib/repositories/career.repo";
import { localize } from "@/lib/schemas/localized";
import { namespaceMetadata } from "@/lib/seo/metadata";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return namespaceMetadata(locale as Locale, "pages.career", "/company/career");
}

export default async function CareerIndex({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SP;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "career" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const sp = await searchParams;
  const q = str(sp.q);

  let result: Awaited<ReturnType<typeof listOpenJobs>> = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 24,
    pages: 1,
  };
  try {
    result = await listOpenJobs({ search: q, pageSize: 48 });
  } catch (e) {
    logger.warn("career index load failed", e);
  }

  const showEmpty = result.items.length === 0 && !q;

  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12.5,
    color: "var(--color-text-muted)",
  };

  return (
    <>
      <PageHeader
        eyebrow={nav("company")}
        title={t("hero.title")}
        description={t("hero.description")}
        image="/smiling-medical-team-portrait.jpeg"
        imageAlt={t("hero.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("company") },
          { label: t("hero.breadcrumb") },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container style={{ display: "grid", gap: "var(--s-6)" }}>
          {showEmpty ? (
            <ComingSoon
              title={t("empty.title")}
              description={t("empty.description")}
              ctaLabel={nav("contact")}
              ctaHref="/contact"
            />
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--s-4)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: "var(--color-text-muted)",
                    fontSize: "var(--fs-body-sm)",
                  }}
                >
                  {t("roles", { count: result.total })}
                </p>
                <LiveSearch
                  placeholder={t("searchPlaceholder")}
                  ariaLabel={t("search")}
                  size="sm"
                  style={{ width: "min(320px, 100%)" }}
                />
              </div>

              {result.items.length === 0 ? (
                <p
                  style={{
                    padding: "var(--s-8)",
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {t("empty.title")}
                </p>
              ) : (
                <div style={{ display: "grid", gap: "var(--s-4)" }}>
                  {result.items.map((j, i) => (
                    <Reveal key={String(j._id)} delay={(i % 6) * 60}>
                      <Link
                        href={`/company/career/${j.slug}`}
                        className="job-card"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "var(--s-5)",
                          padding: "22px 24px",
                          borderRadius: "var(--r-xl)",
                          border: "1px solid var(--color-hairline)",
                          background: "var(--color-surface)",
                          boxShadow: "var(--shadow-xs)",
                          textDecoration: "none",
                        }}
                      >
                        <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                          <h3
                            style={{
                              fontFamily: "var(--font-display)",
                              fontWeight: 600,
                              fontSize: 19,
                              letterSpacing: "-.01em",
                              color: "var(--color-text-strong)",
                              margin: 0,
                            }}
                          >
                            {localize(j.title, l)}
                          </h3>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "var(--s-4)",
                            }}
                          >
                            <span style={chip}>
                              <Briefcase size={14} aria-hidden />
                              {t(`employmentTypes.${j.employmentType}`)}
                            </span>
                            {j.location && (
                              <span style={chip}>
                                <MapPin size={14} aria-hidden />
                                {localize(j.location, l)}
                              </span>
                            )}
                            {j.department && (
                              <span style={chip}>
                                {localize(j.department, l)}
                              </span>
                            )}
                          </div>
                          {j.summary && (
                            <p
                              style={{
                                margin: 0,
                                fontSize: 14,
                                lineHeight: 1.55,
                                color: "var(--color-text-muted)",
                                maxWidth: "70ch",
                              }}
                            >
                              {localize(j.summary, l)}
                            </p>
                          )}
                        </div>
                        <span
                          className="job-card-cta"
                          style={{
                            flexShrink: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            color: "var(--color-brand-deep)",
                            fontWeight: 600,
                            fontSize: 14,
                          }}
                        >
                          {t("viewRole")}
                          <Arrow size={14} />
                        </span>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              )}
            </>
          )}
        </Container>
      </section>
      <style>{`
        .job-card { transition: transform 280ms cubic-bezier(.16,1,.3,1), box-shadow 280ms cubic-bezier(.16,1,.3,1), border-color 280ms; }
        .job-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--teal-300); }
        @media (max-width: 640px) {
          .job-card { flex-direction: column; align-items: flex-start !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .job-card { transition: none; }
          .job-card:hover { transform: none; }
        }
      `}</style>
    </>
  );
}
