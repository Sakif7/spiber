import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/schemas/localized";
import type { Lean } from "@/lib/models/_shared";
import type { IEvent } from "@/lib/models/event";
import type { Locale } from "@/i18n/routing";

/** Format a single date or a start–end range for the given locale. */
function formatRange(
  start: Date,
  end: Date | null | undefined,
  locale: Locale,
) {
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  const s = new Date(start).toLocaleDateString(locale, opts);
  if (!end) return s;
  const e = new Date(end).toLocaleDateString(locale, opts);
  return s === e ? s : `${s} – ${e}`;
}

/**
 * Event listing card (server component). Cover photo with a floating date chip,
 * then title, summary, and location. Hover effects come from the `.event-card`
 * class declared once on the listing page.
 */
export function EventCard({
  event,
  locale,
}: {
  event: Lean<IEvent>;
  locale: Locale;
}) {
  return (
    <Link
      href={`/company/events/${event.slug}`}
      className="event-card"
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--r-xl)",
        overflow: "hidden",
        border: "1px solid var(--color-hairline)",
        background: "var(--color-surface)",
        boxShadow: "var(--shadow-xs)",
        textDecoration: "none",
        height: "100%",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "16 / 10",
          background: "var(--color-surface-2)",
        }}
      >
        {event.coverImage && (
          <Image
            src={event.coverImage}
            alt={localize(event.title, locale)}
            fill
            sizes="(max-width: 700px) 100vw, 360px"
            style={{ objectFit: "cover" }}
          />
        )}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, transparent 55%, rgba(6,37,39,0.45))",
          }}
        />
        <span
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 11px",
            borderRadius: "var(--r-pill)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "#fff",
            background: "rgba(7,23,33,0.55)",
            backdropFilter: "blur(4px)",
          }}
        >
          {formatRange(event.startDate, event.endDate, locale)}
        </span>
      </div>
      <div
        style={{
          padding: "16px 18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: 1,
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 17,
            lineHeight: 1.3,
            letterSpacing: "-.01em",
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          {localize(event.title, locale)}
        </h3>
        {event.summary && (
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--color-text-muted)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {localize(event.summary, locale)}
          </p>
        )}
        {event.location && (
          <span
            style={{
              marginTop: "auto",
              fontSize: 12.5,
              color: "var(--color-brand-deep)",
              fontWeight: 500,
            }}
          >
            {localize(event.location, locale)}
          </span>
        )}
      </div>
    </Link>
  );
}
