"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui";
import { Link } from "@/i18n/navigation";

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
        border: "1px solid rgba(255,255,255,.16)",
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
              src="/spibermed-logo.png"
              alt={t("logoAlt")}
              width={1007}
              height={301}
              style={{
                height: 56,
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
              {["fb", "x", "in", "ig"].map((s) => (
                <Link
                  key={s}
                  href="/contact"
                  className="footer-social"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,.16)",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "rgba(255,255,255,.8)",
                    cursor: "pointer",
                    transition: "all 200ms",
                  }}
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>

          {(t.raw("nav") as Array<[string, string[]]>).map(
            ([title, items], colIndex) => (
              <div key={title}>
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
                  {title}
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {items.map((i, itemIndex) => {
                    const href =
                      colIndex === 0
                        ? "/instruments"
                        : colIndex === 1
                          ? itemIndex === items.length - 1
                            ? "/tourism"
                            : "/consulting"
                          : itemIndex === items.length - 1
                            ? "/contact"
                            : "/about";
                    return (
                      <Link
                        key={i}
                        href={href}
                        className="footer-link"
                        style={{
                          fontSize: 14,
                          color: "rgba(255,255,255,.78)",
                          cursor: "pointer",
                          transition: "color 160ms",
                        }}
                      >
                        {i}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ),
          )}

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
              <div style={{ marginBottom: 10 }}>
                {t("addressLine1")}
                <br />
                {t("addressLine2")}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                +880 1765 193751
                <br />
                +880 1711 739797
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
                <br />
                inquiry@spibermed.com
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
              if (i === 3) {
                return (
                  <a key={i} href="/sitemap.xml">
                    {label}
                  </a>
                );
              }
              const href =
                i === 0 ? "/privacy" : i === 1 ? "/terms" : "/privacy";
              return (
                <Link key={i} href={href}>
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </Container>

      <style>{`
        .footer-social:hover { background: var(--color-brand); border-color: var(--color-brand) !important; }
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
