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
import { TeamMarquee } from "@/components/sections/team-marquee";

/**
 * Homepage "meet the team" — the managing body drifts through a marquee that
 * fades out on both sides (client decision: everyone appears, cards keep
 * their size, no arrow carousel). The dedicated `/company/team` page still
 * shows the static 3 × 2 `TeamGrid`.
 */
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

        <Reveal>
          <TeamMarquee />
        </Reveal>
      </Container>
    </Section>
  );
}
