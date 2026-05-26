"use client";

import { useState } from "react";
import Image from "next/image";
import { Container } from "@/components/ui";

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

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
        placeholder="you@hospital.bd"
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
        {status === "ok" ? "Subscribed" : status === "sending" ? "…" : "Subscribe"}
      </button>
    </form>
  );
}

export function Footer() {
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
              src="/spibermed-logo.jpeg"
              alt="SPIBER MED"
              width={180}
              height={52}
              style={{
                height: 52,
                width: "auto",
                filter: "brightness(1.6)",
                mixBlendMode: "screen",
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
              Empowering healthcare in Bangladesh — clinical-grade equipment, planning, training, and lifelong service.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              {["fb", "x", "in", "ig"].map((s) => (
                <a
                  key={s}
                  href="#"
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
                </a>
              ))}
            </div>
          </div>

          {(
            [
              ["Products", ["Patient Care", "Critical Care", "OR Solutions", "Surgical", "Imaging", "Lab Diagnostics"]],
              ["Services", ["Hospital Planning", "EPC Delivery", "Healthcare IT", "Global Employment", "Medical Tourism"]],
              ["Company", ["Who We Are", "Top Message", "Vision 2040", "Career", "Gallery", "Contact"]],
            ] as const
          ).map(([title, items]) => (
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
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map((i) => (
                  <a
                    key={i}
                    href="#"
                    className="footer-link"
                    style={{
                      fontSize: 14,
                      color: "rgba(255,255,255,.78)",
                      cursor: "pointer",
                      transition: "color 160ms",
                    }}
                  >
                    {i}
                  </a>
                ))}
              </div>
            </div>
          ))}

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
              Stay Informed
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,.7)",
                marginBottom: 14,
                lineHeight: 1.55,
              }}
            >
              Monthly catalog and new-arrival updates.
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
                Road-06, House-47, Level-01, Block-C,
                <br />
                Banani, Dhaka-1213, Bangladesh
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
                info@spiberhcl.com
                <br />
                sales@spiberhcl.com
                <br />
                inquiry@spiberhcl.com
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
          <div>© 2026 SPIBER MED LTD. ALL RIGHTS RESERVED.</div>
          <div style={{ display: "flex", gap: 24 }}>
            <a href="#">PRIVACY</a>
            <a href="#">TERMS</a>
            <a href="#">COOKIES</a>
            <a href="#">SITEMAP</a>
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
