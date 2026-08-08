"use client";

/**
 * Homepage rendition of the managing body — a continuous marquee that fades
 * out on both sides (client-chosen over the arrow carousel). Mirrors the
 * hero's `PartnerMarquee` idiom: a duplicated flex track animated with the
 * shared `heroMarquee` keyframes (globals.css) inside a mask-faded viewport,
 * rendering the exact same `TeamCard` as the grid so the cards keep their
 * size no matter how many people there are.
 *
 * - Pauses on hover / keyboard focus so the card's 3D reveal stays usable.
 * - The duplicate pass is `inert` + aria-hidden, so AT and tab order see six
 *   people, not twelve.
 * - prefers-reduced-motion: animation and mask are dropped and the single
 *   pass becomes a plain manual scroller.
 */
import { useTeamMembers, TeamCard } from "@/components/sections/team-grid";

/** Track width per card — matches the previous 5-up grid's card size. */
const CARD_W = 232;
const GAP = 16;

const MARQUEE_CSS = `
.team-marquee {
  display: flex;
  overflow: hidden;
  padding: 12px 0 20px;
  mask-image: linear-gradient(90deg, transparent, #000 90px, #000 calc(100% - 90px), transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 90px, #000 calc(100% - 90px), transparent);
}
.team-marquee-track {
  display: flex;
  flex-shrink: 0;
  animation: heroMarquee 45s linear infinite;
}
.team-marquee:hover .team-marquee-track,
.team-marquee:focus-within .team-marquee-track {
  animation-play-state: paused;
}
.team-marquee-pass {
  display: flex;
  gap: ${GAP}px;
  padding-right: ${GAP}px;
  flex-shrink: 0;
  perspective: 1400px;
}
.team-marquee-card {
  flex: 0 0 ${CARD_W}px;
  width: ${CARD_W}px;
  min-width: 0;
}
@media (prefers-reduced-motion: reduce) {
  .team-marquee {
    mask-image: none;
    -webkit-mask-image: none;
    overflow-x: auto;
    overscroll-behavior-x: contain;
  }
  .team-marquee-track {
    animation: none;
  }
  .team-marquee-copy {
    display: none;
  }
}
`;

export function TeamMarquee() {
  const team = useTeamMembers();

  return (
    <>
      <style>{MARQUEE_CSS}</style>
      <div className="team-marquee">
        <div className="team-marquee-track">
          {[false, true].map((isCopy) => (
            <div
              key={isCopy ? "copy" : "main"}
              className={`team-marquee-pass${isCopy ? "team-marquee-copy" : ""}`}
              aria-hidden={isCopy || undefined}
              inert={isCopy || undefined}
            >
              {team.map((member) => (
                <div key={member.name} className="team-marquee-card">
                  <TeamCard member={member} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
