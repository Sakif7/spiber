import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { CalendarDays, MapPin } from "lucide-react";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "@/i18n/navigation";
import { Arrow } from "@/components/ui";
import { getPublishedEventBySlug } from "@/lib/repositories/events.repo";
import { localize } from "@/lib/schemas/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const ev = await getPublishedEventBySlug(slug).catch(() => null);
  const l = locale as Locale;
  if (!ev) {
    return pageMetadata({
      locale: l,
      path: `/company/events/${slug}`,
      title: "Events",
    });
  }
  return pageMetadata({
    locale: l,
    path: `/company/events/${slug}`,
    title: localize(ev.title, l),
    description: ev.summary ? localize(ev.summary, l) : undefined,
  });
}

function formatRange(
  start: Date,
  end: Date | null | undefined,
  locale: Locale,
) {
  const dt: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  const s = new Date(start).toLocaleString(locale, dt);
  if (!end) return s;
  const sameDay =
    new Date(start).toDateString() === new Date(end).toDateString();
  const e = new Date(end).toLocaleString(
    locale,
    sameDay ? { hour: "numeric", minute: "2-digit" } : dt,
  );
  return `${s} – ${e}`;
}

export default async function EventDetail({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale, namespace: "events" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const ev = await getPublishedEventBySlug(slug).catch(() => null);
  if (!ev) notFound();

  const cover = ev.coverImage || "/cpr-training-manikin-with-aed.jpeg";

  return (
    <>
      <PageHeader
        eyebrow={new Date(ev.startDate).toLocaleDateString(l, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
        title={localize(ev.title, l)}
        description={ev.summary ? localize(ev.summary, l) : undefined}
        image={cover}
        imageAlt={localize(ev.title, l)}
        breadcrumbs={[
          { label: nav("home"), href: "/" },
          { label: t("hero.breadcrumb"), href: "/company/events" },
          { label: localize(ev.title, l) },
        ]}
      />
      <section style={{ paddingBlock: "clamp(40px, 5vw, 80px)" }}>
        <Container style={{ display: "grid", gap: "var(--s-6)" }}>
          <Link
            href="/company/events"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 500,
              color: "var(--color-brand-deep)",
              width: "fit-content",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t("back")}
          </Link>

          <div
            className="event-detail-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 0.9fr",
              gap: "clamp(28px, 4vw, 56px)",
              alignItems: "start",
            }}
          >
            <article>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "var(--fs-h4)",
                  color: "var(--color-text-strong)",
                  margin: "0 0 16px",
                }}
              >
                {t("about")}
              </h2>
              <div
                style={{
                  fontSize: "var(--fs-body-lg)",
                  lineHeight: 1.75,
                  color: "var(--color-text-muted)",
                  whiteSpace: "pre-line",
                }}
              >
                {localize(ev.description, l)}
              </div>
            </article>

            <aside
              style={{
                position: "relative",
                padding: "24px 24px 28px",
                borderRadius: "var(--r-xl)",
                border: "1px solid var(--color-hairline)",
                background: "var(--color-surface-2)",
                display: "grid",
                gap: "var(--s-5)",
              }}
            >
              <DetailRow icon="calendar" label={t("when")}>
                {formatRange(ev.startDate, ev.endDate, l)}
              </DetailRow>
              {ev.location && (
                <DetailRow icon="pin" label={t("where")}>
                  {localize(ev.location, l)}
                </DetailRow>
              )}
              {ev.registrationUrl && (
                <a
                  href={ev.registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "13px 22px",
                    borderRadius: "var(--r-pill)",
                    background: "var(--color-brand)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 15,
                    textDecoration: "none",
                    boxShadow: "var(--shadow-brand)",
                  }}
                >
                  {t("register")} <Arrow size={16} />
                </a>
              )}
            </aside>
          </div>
        </Container>
      </section>
      <style>{`
        @media (max-width: 860px) {
          .event-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: "calendar" | "pin";
  label: string;
  children: React.ReactNode;
}) {
  const Icon = icon === "calendar" ? CalendarDays : MapPin;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 38,
          height: 38,
          flexShrink: 0,
          borderRadius: "var(--r-md)",
          background: "var(--color-brand-soft)",
          color: "var(--color-brand)",
        }}
      >
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <div style={{ display: "grid", gap: 2 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: ".12em",
            color: "var(--color-text-subtle)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 14.5,
            color: "var(--color-text-strong)",
            fontWeight: 500,
          }}
        >
          {children}
        </span>
      </div>
    </div>
  );
}
