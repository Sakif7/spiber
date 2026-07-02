"use client";

import { CSSProperties, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { Container, DotPattern } from "@/components/ui";

/**
 * Newsletter sign-up as a scroll-expanding CTA banner: a deep-teal card that
 * starts inset + rounded and scales up to fill the section edge-to-edge as it
 * reaches the viewport centre (matches the About page's closing CTA).
 * Transform/opacity only; static (filled) under reduced motion. Posts to the
 * shared, rate-limited /api/newsletter.
 */
export function KartNewsletter() {
  const t = useTranslations("marketplace.newsletter");
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const radius = useTransform(scrollYProgress, [0, 1], [44, 0]);

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus("error");
      setMsg(t("invalid"));
      return;
    }
    setStatus("loading");
    setMsg(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (res.ok) {
        setStatus("ok");
        setMsg(t("success"));
        setEmail("");
      } else {
        setStatus("error");
        setMsg(t("error"));
      }
    } catch {
      setStatus("error");
      setMsg(t("error"));
    }
  }

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        background: "var(--color-surface)",
        paddingBlock: 0,
        overflow: "hidden",
      }}
    >
      <motion.div
        style={{
          position: "relative",
          overflow: "hidden",
          width: "100%",
          color: "#fff",
          background:
            "linear-gradient(120deg, var(--teal-800), var(--teal-900))",
          boxShadow: "var(--shadow-xl)",
          transformOrigin: "center",
          willChange: "transform",
          scale: reduced ? 1 : scale,
          borderRadius: reduced ? 0 : radius,
        }}
      >
        <DotPattern
          color="var(--teal-300)"
          gap={20}
          fade="radial"
          style={{
            inset: "auto",
            top: -90,
            right: -70,
            width: 480,
            height: 480,
            opacity: 0.18,
          }}
        />
        <Container style={{ paddingBlock: "clamp(40px, 6vw, 76px)" }}>
          <div className="kart-news-cta">
            <span className="kart-news-icon" aria-hidden>
              <Mail size={24} strokeWidth={1.8} />
            </span>
            <div>
              <h2 style={ctaTitle}>{t("title")}</h2>
              <p style={ctaNote}>{t("note")}</p>
            </div>
            <form className="kart-news-form" onSubmit={submit} noValidate>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("placeholder")}
                aria-label={t("placeholder")}
                maxLength={200}
              />
              <button type="submit" disabled={status === "loading"}>
                {status === "loading" ? t("submitting") : t("submit")}
              </button>
            </form>
          </div>
          {msg && (
            <p
              className="kart-news-msg"
              data-tone={status === "ok" ? "ok" : "error"}
              role="status"
              style={{ marginTop: "var(--s-3)" }}
            >
              {msg}
            </p>
          )}
        </Container>
      </motion.div>
    </section>
  );
}

const ctaTitle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "clamp(1.4rem, 1.05rem + 1.4vw, 2.1rem)",
  lineHeight: 1.12,
  letterSpacing: "-0.02em",
  color: "#fff",
  textWrap: "balance" as CSSProperties["textWrap"],
};
const ctaNote: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "var(--fs-body-lg)",
  lineHeight: 1.55,
  color: "rgba(255,255,255,0.72)",
};
