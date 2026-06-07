"use client";

import { useTranslations } from "next-intl";
import { Container, Breadcrumb, Reveal } from "@/components/ui";
import { ParticleField } from "@/components/ui/particle-field";

/**
 * Contact hero — a dark, photo-free header with an animated white particle
 * constellation (matches the approved mockup). Mirrors the site's standard
 * dark hero styling (gradient + legibility wash + breadcrumb-on-dark) but
 * swaps the photo for the canvas particle field.
 */
export function ContactHero() {
  const t = useTranslations("contact.hero");
  const nav = useTranslations("nav");

  return (
    <header
      style={{
        position: "relative",
        isolation: "isolate",
        display: "flex",
        alignItems: "flex-end",
        minHeight: "clamp(300px, 40vw, 460px)",
        paddingTop: "calc(var(--s-24) + 24px)",
        paddingBottom: "var(--s-12)",
        overflow: "hidden",
        background:
          "radial-gradient(120% 130% at 82% 6%, var(--teal-800) 0%, transparent 52%), linear-gradient(120deg, #052831 0%, #04181f 58%, #03121a 100%)",
      }}
    >
      {/* Animated constellation (decorative). */}
      <ParticleField color="255,255,255" />

      {/* Left-side legibility wash so the heading stays crisp over the dots. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          background:
            "linear-gradient(95deg, rgba(3,18,26,0.72) 0%, rgba(3,18,26,0.30) 42%, transparent 72%), linear-gradient(0deg, rgba(3,18,26,0.55), transparent 55%)",
        }}
      />

      <Container style={{ position: "relative", width: "100%" }}>
        <Reveal>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-4)",
            }}
          >
            <Breadcrumb
              items={[
                { label: nav("home"), href: "/" },
                { label: t("breadcrumb") },
              ]}
              tone="onDark"
            />
            <h1
              style={{
                fontSize: "var(--fs-h1)",
                lineHeight: "var(--lh-heading)",
                letterSpacing: "var(--tracking-heading)",
                color: "#fff",
                maxWidth: "20ch",
                textShadow: "0 2px 24px rgba(3,18,26,0.5)",
              }}
            >
              {t("title")}
            </h1>
            <p
              style={{
                fontSize: "var(--fs-body-lg)",
                color: "rgba(255,255,255,0.86)",
                maxWidth: "52ch",
                textShadow: "0 1px 16px rgba(3,18,26,0.45)",
              }}
            >
              {t("description")}
            </p>
          </div>
        </Reveal>
      </Container>
    </header>
  );
}
