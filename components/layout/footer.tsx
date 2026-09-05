"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { SOCIALS } from "./social-links";

/** Destinations for the footer legal row, in the order the labels appear. */
const LEGAL_HREFS = [
  "/guide",
  "/privacy",
  "/terms",
  "/privacy",
  "/sitemap.xml",
];

function NewsletterForm() {
  const t = useTranslations("footer");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(
    "idle",
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "ok" : "error");
      if (res.ok) setEmail("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        background: "rgba(255,255,255,.06)",
        // 40% is the minimum white-alpha that clears SC 1.4.11's 3:1 against
        // this field's own fill on the dark footer (.16 measured only 1.39:1).
        border: "1px solid rgba(255,255,255,.40)",
        borderRadius: 999,
        padding: 4,
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("newsletterPlaceholder")}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          padding: "10px 14px",
          fontSize: 13,
          color: "white",
          outline: "none",
          fontFamily: "var(--font-body)",
        }}
      />
      <button
        type="submit"
        disabled={status === "sending"}
        style={{
          background: "var(--color-brand)",
          color: "white",
          border: "none",
          padding: "8px 16px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 500,
          cursor: status === "sending" ? "wait" : "pointer",
          opacity: status === "sending" ? 0.7 : 1,
        }}
      >
        {status === "ok"
          ? t("subscribed")
          : status === "sending"
            ? "…"
            : t("subscribe")}
      </button>
    </form>
  );
}

export function Footer() {
  const t = useTranslations("footer");
  return (
    <footer
      style={{
        background: "var(--slate-900)",
        color: "white",
        paddingBlock: 64,
        borderTop: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <Container>
        <div
          className="footer-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1.2fr",
            gap: 36,
            paddingBottom: 40,
            borderBottom: "1px solid rgba(255,255,255,.10)",
          }}
        >
          <div>
            <Image
              src="/spibermed-wordmark.png"
              alt={t("logoAlt")}
              width={932}
              height={355}
              style={{
                height: 48,
                width: "auto",
                marginBottom: 18,
              }}
            />
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "rgba(255,255,255,.7)",
                maxWidth: 320,
              }}
            >
              {t("tagline")}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              {SOCIALS.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  aria-label={s.label}
                  title={s.label}
                  className="footer-social"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.16)",
                    display: "grid",
                    placeItems: "center",
                    color: "rgba(255,255,255,.8)",
                    cursor: "pointer",
                    transition: "all 200ms",
                  }}
                >
                  {s.icon(18)}
                </Link>
              ))}
            </div>
          </div>

          {(
            t.raw("nav") as Array<{
              title?: string;
              links?: Array<{ label: string; href: string }>;
              sections?: Array<{
                title: string;
                links: Array<{ label: string; href: string }>;
              }>;
            }>
          ).map((col, ci) => {
            // A column is either a single titled group or several stacked
            // sections (e.g. Products + Services share one column).
            const sections = col.sections ?? [
              { title: col.title ?? "", links: col.links ?? [] },
            ];
            return (
              <div
                key={col.title ?? ci}
                style={{ display: "flex", flexDirection: "column", gap: 28 }}
              >
                {sections.map((sec) => (
                  <div key={sec.title}>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        color: "var(--teal-300)",
                        marginBottom: 16,
                      }}
                    >
                      {sec.title}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {sec.links.map((l) => (
                        <Link
                          key={l.href + l.label}
                          href={l.href}
                          className="footer-link"
                          style={{
                            fontSize: 14,
                            color: "rgba(255,255,255,.78)",
                            cursor: "pointer",
                            transition: "color 160ms",
                          }}
                        >
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--teal-300)",
                marginBottom: 16,
              }}
            >
              {t("stayInformed")}
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,.7)",
                marginBottom: 14,
                lineHeight: 1.55,
              }}
            >
              {t("newsletterDesc")}
            </div>
            <NewsletterForm />
            <div
              style={{
                marginTop: 22,
                fontSize: 13,
                lineHeight: 1.7,
                color: "rgba(255,255,255,.7)",
              }}
            >
              <div>Head Office:</div>
              <div style={{ marginBottom: 10 }}>
                {t("addressLine1")}
                <br />
                {t("addressLine2")}
              </div>
              <div>Regional Office:</div>
              <div style={{ marginBottom: 10 }}>
                Summer Hill, House-2226/2641,
                <br />
                Panchlaish, Chittagong-4211, Bangladesh
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                <a href="tel:+8801346092798">+880 1346 092798</a>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  marginTop: 8,
                  color: "var(--teal-300)",
                }}
              >
                info@spibermed.com
                <br />
                sales@spibermed.com
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 24,
            color: "rgba(255,255,255,.5)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            letterSpacing: ".02em",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>{t("copyright")}</div>
          <div style={{ display: "flex", gap: 24 }}>
            {(t.raw("legal") as string[]).map((label, i) => {
              // Positional, matching the `footer.legal` array in every locale:
              // guide, privacy, terms, cookies (part of the privacy policy),
              // sitemap. The sitemap is a generated file, not an app route.
              const href = LEGAL_HREFS[i] ?? "/privacy";
              return href === "/sitemap.xml" ? (
                <a key={i} href={href}>
                  {label}
                </a>
              ) : (
                <Link key={i} href={href}>
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </Container>

      <style>{`
        .footer-social:hover { background: var(--color-brand); border-color: var(--color-brand) !important; color: #fff; }
        .footer-link:hover { color: var(--teal-300); }
        @media (max-width: 980px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}
