"use client";

import Image from "next/image";
import { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Container, Eyebrow, Reveal, Section } from "@/components/ui";

/** "Experience That Makes a Difference" — photo (left) + copy & check bullets. */
export function AboutEncounter() {
  const t = useTranslations("about.encounter");
  const points = t.raw("points") as string[];

  return (
    <Section>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "clamp(32px, 5vw, 72px)",
            alignItems: "center",
          }}
        >
          <Reveal delay={120}>
            {/* TODO: swap placeholder for a real clinical/OR photo. */}
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
                src="/modern-operating-room-equipment.jpeg"
                alt={t("imageAlt")}
                fill
                sizes="(max-width: 980px) 100vw, 46vw"
                style={{ objectFit: "cover", objectPosition: "center" }}
              />
            </div>
          </Reveal>

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
                  maxWidth: "16ch",
                  textWrap: "balance" as CSSProperties["textWrap"],
                }}
              >
                {t("title")}
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--fs-body-lg)",
                  lineHeight: 1.7,
                  color: "var(--color-text-muted)",
                  maxWidth: "60ch",
                }}
              >
                {t("body")}
              </p>
            </Reveal>

            <div
              style={{
                marginTop: 30,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {points.map((pt, i) => (
                <Reveal key={pt} delay={220 + i * 80}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <CheckCircle2
                      size={22}
                      strokeWidth={1.8}
                      style={{
                        color: "var(--color-brand)",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                      aria-hidden
                    />
                    <span
                      style={{
                        fontSize: "var(--fs-body)",
                        lineHeight: 1.5,
                        color: "var(--color-text)",
                      }}
                    >
                      {pt}
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
