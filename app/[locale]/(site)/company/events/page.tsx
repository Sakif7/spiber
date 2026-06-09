import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { ComingSoon } from "@/components/ui/coming-soon";
import { LiveSearch } from "@/components/ui/live-search";
import { Reveal } from "@/components/ui/reveal";
import { EventCard } from "@/components/company/events/event-card";
import { listPublishedEvents } from "@/lib/repositories/events.repo";
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
  return namespaceMetadata(locale as Locale, "pages.events", "/company/events");
}

const sectionHeading: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "var(--fs-h4)",
  letterSpacing: "-.01em",
  color: "var(--color-text-strong)",
  margin: "0 0 var(--s-5)",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  gap: "var(--s-5)",
};

export default async function EventsIndex({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SP;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "events" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const sp = await searchParams;
  const q = str(sp.q);

  let upcoming: Awaited<ReturnType<typeof listPublishedEvents>>["items"] = [];
  let past: Awaited<ReturnType<typeof listPublishedEvents>>["items"] = [];
  try {
    const [u, p] = await Promise.all([
      listPublishedEvents({ when: "upcoming", search: q, pageSize: 24 }),
      listPublishedEvents({ when: "past", search: q, pageSize: 12 }),
    ]);
    upcoming = u.items;
    past = p.items;
  } catch (e) {
    logger.warn("events index load failed", e);
  }

  const showEmpty = upcoming.length === 0 && past.length === 0 && !q;

  return (
    <>
      <PageHeader
        eyebrow={nav("company")}
        title={t("hero.title")}
        description={t("hero.description")}
        image="/cpr-training-manikin-with-aed.jpeg"
        imageAlt={t("hero.title")}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: nav("company") },
          { label: t("hero.breadcrumb") },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container style={{ display: "grid", gap: "var(--s-8)" }}>
          {showEmpty ? (
            <ComingSoon
              title={t("empty.title")}
              description={t("empty.description")}
            />
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <LiveSearch
                  placeholder={t("searchPlaceholder")}
                  ariaLabel={t("search")}
                  size="sm"
                  style={{ width: "min(320px, 100%)" }}
                />
              </div>

              <div>
                <h2 style={sectionHeading}>{t("upcoming")}</h2>
                {upcoming.length === 0 ? (
                  <p style={{ color: "var(--color-text-muted)" }}>
                    {t("noUpcoming")}
                  </p>
                ) : (
                  <div style={grid}>
                    {upcoming.map((e, i) => (
                      <Reveal key={String(e._id)} delay={(i % 3) * 70}>
                        <EventCard event={e} locale={l} />
                      </Reveal>
                    ))}
                  </div>
                )}
              </div>

              {past.length > 0 && (
                <div>
                  <h2 style={sectionHeading}>{t("past")}</h2>
                  <div style={grid}>
                    {past.map((e, i) => (
                      <Reveal key={String(e._id)} delay={(i % 3) * 70}>
                        <EventCard event={e} locale={l} />
                      </Reveal>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Container>
      </section>
      <style>{`
        .event-card { transition: transform 320ms cubic-bezier(.16,1,.3,1), box-shadow 320ms cubic-bezier(.16,1,.3,1), border-color 320ms; }
        .event-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); border-color: var(--teal-300); }
        .event-card img { transition: transform 600ms cubic-bezier(.16,1,.3,1); }
        .event-card:hover img { transform: scale(1.04); }
        @media (prefers-reduced-motion: reduce) {
          .event-card, .event-card img { transition: none; }
          .event-card:hover { transform: none; }
          .event-card:hover img { transform: none; }
        }
      `}</style>
    </>
  );
}
