"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Arrow,
  Container,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/ui";
import { TeamGrid } from "@/components/sections/team-grid";
// Option C only — see the renditions block below.
// import { TeamCarousel } from "@/components/sections/team-carousel";

/* ───────────────────────────────────────────────────────────────────────────
 * HOMEPAGE "MEET THE TEAM" — RENDITIONS
 *
 * The managing body is now SIX people. `/company/team` always shows all six
 * (3 x 2). The homepage has a trade-off, so the options are staged here:
 * uncomment ONE and comment out the others to demo it.
 *
 *   A · FIVE ACROSS  (active)  Cards keep their exact current size. Faria is
 *                              not on the homepage — she is on /company/team,
 *                              which the "View full team" link points at.
 *   B · SIX ACROSS             Everyone fits in one row, but every card gets
 *                              ~20% narrower (232px -> ~190px).
 *   C · CAROUSEL               Everyone, cards keep their size, but the client
 *                              has said they don't want a carousel.
 *   D · THREE x TWO            Everyone, and the cards get BIGGER (~400px)
 *                              rather than smaller. Costs vertical height.
 *                              ← recommended; see the note in the handover.
 * ─────────────────────────────────────────────────────────────────────────── */

export function Management() {
  const t = useTranslations("home.management");

  return (
    <Section>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "end",
            marginBottom: 48,
          }}
        >
          <SectionTitle
            eyebrow={t("eyebrow")}
            title={t("title")}
            lede={t("lede")}
          />
          <Reveal delay={200} style={{ alignSelf: "end" }}>
            <Link
              href="/company/team"
              style={{
                alignSelf: "end",
                justifySelf: "end",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--color-brand-deep)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              {t("viewFullTeam")} <Arrow />
            </Link>
          </Reveal>
        </div>

        {/* ── A · FIVE ACROSS — current size preserved (ACTIVE) ───────────── */}
        <TeamGrid columns={5} limit={5} />

        {/* ── B · SIX ACROSS — everyone in one row, all cards ~20% smaller ──
        <TeamGrid columns={6} />
        */}

        {/* ── C · CAROUSEL — everyone, cards keep their size, rail scrolls ──
            Also uncomment the TeamCarousel import at the top of this file.
        <TeamCarousel />
        */}

        {/* ── D · THREE x TWO — everyone, cards get BIGGER, section gets taller
        <TeamGrid columns={3} />
        */}
      </Container>
    </Section>
  );
}
