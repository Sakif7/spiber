"use client";

import { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Phone, Mail, Clock } from "lucide-react";
import { Container, DotPattern, Reveal, Section } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { CONTACT } from "@/lib/contact";
import { SOCIALS } from "@/components/layout/social-links";

/**
 * Teal "Prefer a quicker way to reach us?" strip — Call / Email / Hours /
 * Connect, all pulled from the same shared contact data as the footer.
 */
export function QuickContact() {
  const t = useTranslations("contact.quick");
  return (
    <Section
      style={{
        background: "linear-gradient(105deg, var(--teal-600), var(--teal-800))",
        color: "#fff",
      }}
      py="clamp(52px, 6vw, 88px)"
    >
      <DotPattern
        color="var(--teal-300)"
        gap={20}
        fade="radial"
        style={{ opacity: 0.16 }}
      />
      <Container style={{ position: "relative" }}>
        <Reveal>
          <h2
            style={{
              textAlign: "center",
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-h3)",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              marginBottom: "clamp(28px, 4vw, 44px)",
            }}
          >
            {t("title")}
          </h2>
        </Reveal>

        <div
          className="equal-4col quick-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 28,
            alignItems: "start",
          }}
        >
          <Reveal>
            <Channel
              icon={<Phone size={20} strokeWidth={1.9} />}
              label={t("call")}
              note={t("callNote")}
            >
              <a href={`tel:${CONTACT.phoneHref}`} style={valueStyle}>
                {CONTACT.phone}
              </a>
            </Channel>
          </Reveal>

          <Reveal delay={90}>
            <Channel
              icon={<Mail size={20} strokeWidth={1.9} />}
              label={t("email")}
              note={t("emailNote")}
            >
              <a href={`mailto:${CONTACT.generalEmail}`} style={valueStyle}>
                {CONTACT.generalEmail}
              </a>
            </Channel>
          </Reveal>

          <Reveal delay={180}>
            <Channel
              icon={<Clock size={20} strokeWidth={1.9} />}
              label={t("hours")}
              note={t("hoursNote")}
            >
              <span style={valueStyle}>{t("hoursValue")}</span>
            </Channel>
          </Reveal>

          <Reveal delay={270}>
            <Channel label={t("connect")}>
              <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                {SOCIALS.map((s) => (
                  <Link
                    key={s.key}
                    href={s.href}
                    aria-label={s.label}
                    title={s.label}
                    className="quick-social"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "var(--radius-pill)",
                      border: "1px solid rgba(255,255,255,.28)",
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                      transition: "background 180ms, border-color 180ms",
                    }}
                  >
                    {s.icon(17)}
                  </Link>
                ))}
              </div>
            </Channel>
          </Reveal>
        </div>
      </Container>

      <style>{`
        .quick-grid > * { border-left: 1px solid rgba(255,255,255,.16); padding-left: 28px; }
        .quick-grid > *:first-child { border-left: none; padding-left: 0; }
        .quick-social:hover { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.5); }
        @media (max-width: 980px) {
          .quick-grid > * { border-left: none; padding-left: 0; }
        }
      `}</style>
    </Section>
  );
}

const valueStyle: CSSProperties = {
  color: "#fff",
  fontSize: "var(--fs-body)",
  fontWeight: 600,
  textDecoration: "none",
  wordBreak: "break-word",
};

function Channel({
  icon,
  label,
  note,
  children,
}: {
  icon?: ReactNode;
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {icon && (
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: "var(--radius-pill)",
            display: "grid",
            placeItems: "center",
            background: "rgba(255,255,255,.12)",
            color: "#fff",
          }}
        >
          {icon}
        </span>
      )}
      <div style={{ display: "grid", gap: 4 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-caption)",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-eyebrow)",
            color: "rgba(255,255,255,.72)",
          }}
        >
          {label}
        </span>
        {children}
        {note && (
          <span
            style={{
              fontSize: "var(--fs-small)",
              color: "rgba(255,255,255,.66)",
            }}
          >
            {note}
          </span>
        )}
      </div>
    </div>
  );
}
