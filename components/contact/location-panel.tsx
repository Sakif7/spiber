"use client";

import { CSSProperties, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Phone, Mail, Clock, Plus, ArrowRight } from "lucide-react";
import {
  OFFICES,
  mapEmbedUrl,
  mapDirectionsUrl,
  type Localized,
} from "@/lib/contact";

function L(v: Localized, locale: string): string {
  return locale === "bn" && v.bn ? v.bn : v.en;
}

/**
 * Right column of the contact block: a location switcher + a map of the
 * selected office's area + that office's detail card. All driven by `OFFICES`,
 * so a new office is one config entry. The switcher is a `role="group"` of
 * toggle buttons (`aria-pressed`) — a plain, fully keyboard-operable pattern
 * (no roving-tabindex / arrow-key obligations of the ARIA tabs pattern).
 *
 * `height: 100%` + the flexible map let the panel stretch so its bottom edge
 * lines up with the form card beside it.
 */
export function LocationPanel() {
  const t = useTranslations("contact.locations");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState(0);
  const office = OFFICES[selected];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        height: "100%",
      }}
    >
      {/* Location switcher */}
      <div
        role="group"
        aria-label={t("title")}
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {OFFICES.map((o, i) => {
          const active = i === selected;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(i)}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                border: active
                  ? "1px solid transparent"
                  : "1px solid var(--color-hairline)",
                background: "transparent",
                borderRadius: "var(--radius-pill)",
                padding: "8px 15px",
                fontSize: "var(--fs-small)",
                fontWeight: 500,
                color: active ? "#fff" : "var(--color-text-muted)",
                cursor: "pointer",
                transition: "color 200ms",
                isolation: "isolate",
              }}
            >
              {active &&
                (reduced ? (
                  <span aria-hidden style={{ ...pillFill }} />
                ) : (
                  <motion.span
                    aria-hidden
                    layoutId="contact-pill-hl"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    style={{ ...pillFill }}
                  />
                ))}
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MapPin size={13} strokeWidth={2} />
                {L(o.shortName, locale)}
              </span>
            </button>
          );
        })}

        {/* Visual-only "add office" affordance (more locations coming). */}
        <span
          aria-hidden="true"
          title={t("more")}
          style={{
            width: 34,
            height: 34,
            borderRadius: "var(--radius-pill)",
            border: "1px dashed var(--color-hairline)",
            display: "grid",
            placeItems: "center",
            color: "var(--color-text-subtle)",
          }}
        >
          <Plus size={15} />
        </span>
      </div>

      {/* Map slot. Only the Dhaka head office shows an embedded map (per the
          client); regional offices render a branded address placeholder and
          rely on the "Get directions" link in the detail card. Flexes to fill
          remaining height so the panel bottom aligns with the form card.
          Coordinate-centred + marker-less (shows the area, no pin). */}
      <div
        style={{
          position: "relative",
          flex: "1 1 auto",
          minHeight: 230,
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          border: "1px solid var(--color-hairline)",
          boxShadow: "var(--shadow-sm)",
          background: "var(--color-surface-2)",
        }}
      >
        {office.showMap ? (
          <iframe
            key={office.id}
            className="contact-map-frame"
            title={`${L(office.name, locale)} — ${t("mapLabel")}`}
            src={mapEmbedUrl(office.lat, office.lng, office.zoom)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{ position: "absolute", inset: 0, border: 0 }}
          />
        ) : (
          <motion.div
            key={office.id}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              padding: 24,
              gap: 10,
            }}
          >
            <span
              style={{
                width: 52,
                height: 52,
                borderRadius: "var(--radius-pill)",
                display: "grid",
                placeItems: "center",
                background: "var(--color-brand-soft)",
                color: "var(--color-brand-deep)",
              }}
            >
              <MapPin size={24} strokeWidth={1.8} />
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--fs-body)",
                fontWeight: 600,
                color: "var(--color-text-strong)",
              }}
            >
              {L(office.shortName, locale)}
            </span>
            <span
              style={{
                fontSize: "var(--fs-small)",
                color: "var(--color-text-muted)",
                maxWidth: "32ch",
              }}
            >
              {t("noMapHint")}
            </span>
          </motion.div>
        )}
      </div>

      {/* Office detail card — updates with the switcher. */}
      <motion.div
        key={office.id}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-hairline)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          padding: "clamp(18px, 2.4vw, 24px)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-h5)",
            fontWeight: 600,
            color: "var(--color-brand-deep)",
            marginBottom: 14,
          }}
        >
          {L(office.name, locale)}
        </h3>

        <div style={{ display: "grid", gap: 12 }}>
          <DetailRow icon={<MapPin size={16} />} label={t("address")}>
            <span style={{ whiteSpace: "pre-line" }}>
              {L(office.address, locale)}
            </span>
          </DetailRow>
          <DetailRow icon={<Phone size={16} />} label={t("phone")}>
            <a href={`tel:${office.phoneHref}`} style={linkStyle}>
              {office.phone}
            </a>
          </DetailRow>
          <DetailRow icon={<Mail size={16} />} label={t("email")}>
            <a href={`mailto:${office.email}`} style={linkStyle}>
              {office.email}
            </a>
          </DetailRow>
          <DetailRow icon={<Clock size={16} />} label={t("hours")}>
            {L(office.hours, locale)}
          </DetailRow>
        </div>

        <a
          href={mapDirectionsUrl(office.mapsQuery)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 18,
            color: "var(--color-brand-deep)",
            fontSize: "var(--fs-small)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {t("directions")} <ArrowRight size={15} />
        </a>
      </motion.div>
    </div>
  );
}

const pillFill: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 0,
  borderRadius: "var(--radius-pill)",
  background: "var(--color-brand)",
  boxShadow: "var(--shadow-brand)",
};

const linkStyle: CSSProperties = {
  color: "var(--color-text)",
  textDecoration: "none",
};

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span
        style={{ flexShrink: 0, marginTop: 1, color: "var(--color-brand)" }}
      >
        {icon}
      </span>
      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-micro)",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-eyebrow)",
            color: "var(--color-text-subtle)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: "var(--fs-body-sm)",
            color: "var(--color-text)",
            lineHeight: 1.55,
          }}
        >
          {children}
        </span>
      </div>
    </div>
  );
}
