"use client";

import Image from "next/image";
import { CSSProperties, useState } from "react";
import { useTranslations } from "next-intl";
import { Container, Eyebrow, Reveal, Section } from "@/components/ui";

/**
 * "Our Total Solution" — one bespoke image per pillar.
 * TODO: replace each placeholder with the final art (save to /public, swap src):
 *   01 Design     → /solution-design.jpg
 *   02 Equipment  → /solution-equipment.jpg
 *   03 Service    → /solution-service.jpg
 *   04 Support    → /solution-support.jpg
 * (Generation prompts were handed off alongside this change.)
 */
const PILLAR_IMAGES = [
  "/empty-hospital-ward-beds.jpeg", // Design (placeholder)
  "/dialysis-machine-medical-equipment.jpeg", // Equipment (placeholder)
  "/lab-technician-using-analyzer-machine.jpeg", // Service (placeholder)
  "/nurse-holding-patient-hand-reassurance.jpeg", // Support (placeholder)
];

/**
 * "A Passion for Healthcare" — intro (copy + photo) followed by the
 * four-pillar "Our Total Solution" row.
 */
export function AboutPassion() {
  const t = useTranslations("about.passion");
  const pillars = t.raw("pillars") as Array<{ title: string; body: string }>;

  return (
    <Section style={{ background: "var(--color-surface)" }}>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 0.95fr",
            gap: "clamp(32px, 5vw, 72px)",
            alignItems: "center",
          }}
        >
          <div>
            <Reveal>
              <Eyebrow>{t("eyebrow")}</Eyebrow>
            </Reveal>
            <Reveal delay={90}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "var(--fs-h2)",
                  lineHeight: 1.08,
                  letterSpacing: "-.02em",
                  color: "var(--color-text-strong)",
                  margin: "18px 0 22px",
                  maxWidth: "18ch",
                  textWrap: "balance" as CSSProperties["textWrap"],
                }}
              >
                {t("title")}
              </h2>
            </Reveal>
            <Reveal delay={170}>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--fs-body-lg)",
                  lineHeight: 1.7,
                  color: "var(--color-text-muted)",
                  maxWidth: "62ch",
                }}
              >
                {t("body")}
              </p>
            </Reveal>
          </div>

          <Reveal delay={120}>
            {/* TODO: swap placeholder for a real Spiber Med facility/team photo. */}
            <div
              style={{
                position: "relative",
                aspectRatio: "4 / 3",
                borderRadius: "var(--r-xl)",
                overflow: "hidden",
                boxShadow: "var(--shadow-lg)",
                border: "1px solid var(--color-hairline)",
              }}
            >
              <Image
                src="/reception.png"
                alt={t("imageAlt")}
                fill
                sizes="(max-width: 980px) 100vw, 46vw"
                style={{ objectFit: "cover", objectPosition: "center 25%" }}
              />
              {/* Brand wash at the foot of the photo. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, transparent 58%, color-mix(in oklab, var(--brand-teal) 24%, transparent))",
                }}
              />
            </div>
          </Reveal>
        </div>

        {/* Our Total Solution */}
        <div style={{ marginTop: "clamp(48px, 6vw, 88px)" }}>
          <Reveal>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 36,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: "var(--color-brand-deep)",
                  whiteSpace: "nowrap",
                }}
              >
                {t("solutionLabel")}
              </span>
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: "var(--color-hairline)",
                }}
              />
            </div>
          </Reveal>

          <div
            className="equal-4col"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
            }}
          >
            {pillars.map((p, i) => (
              <Reveal key={p.title} delay={i * 90}>
                <Pillar
                  image={PILLAR_IMAGES[i]}
                  index={i + 1}
                  title={p.title}
                  body={p.body}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

function Pillar({
  image,
  index,
  title,
  body,
}: {
  image: string;
  index: number;
  title: string;
  body: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: "var(--r-xl)",
        background: "var(--color-surface)",
        border:
          "1px solid " + (hover ? "var(--teal-300)" : "var(--color-hairline)"),
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-xs)",
        transform: hover ? "translateY(-3px)" : "translateY(0)",
        transition: "all 320ms cubic-bezier(.16,1,.3,1)",
      }}
    >
      {/* Hover accent bar */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          zIndex: 2,
          background:
            "linear-gradient(90deg, var(--brand-teal), var(--aqua-400))",
          transform: hover ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left",
          transition: "transform 420ms cubic-bezier(.16,1,.3,1)",
        }}
      />

      {/* Image header */}
      <div
        style={{
          position: "relative",
          aspectRatio: "16 / 11",
          overflow: "hidden",
        }}
      >
        {/* TODO: bespoke per-pillar image (see PILLAR_IMAGES note above). */}
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 980px) 50vw, 22vw"
          style={{
            objectFit: "cover",
            transform: hover ? "scale(1.06)" : "scale(1)",
            transition: "transform 700ms cubic-bezier(.16,1,.3,1)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(6,37,39,0.12), rgba(6,37,39,0.42))",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "grid",
            placeItems: "center",
            width: 34,
            height: 34,
            borderRadius: "var(--r-md)",
            background: "rgba(255,255,255,0.16)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.3)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            letterSpacing: ".04em",
          }}
        >
          {String(index).padStart(2, "0")}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 22px 24px" }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: "-.01em",
            color: "var(--color-text-strong)",
            margin: "0 0 8px",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--color-text-muted)",
          }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}
