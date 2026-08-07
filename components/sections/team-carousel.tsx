"use client";

/**
 * ALTERNATIVE homepage rendition of the managing body — a swipeable rail.
 *
 * NOT used by default: the client has said they don't want a carousel on the
 * homepage. It exists so the option can be demoed by swapping one line in
 * `components/sections/management.tsx`. Renders the exact same `TeamCard` as
 * the grid, so the cards keep their current size no matter how many people
 * there are — the rail scrolls instead of the cards shrinking.
 *
 * Scroll-snap based (no dependency): native horizontal scrolling with snap
 * points, plus prev/next buttons for pointer users. Keyboard and touch work for
 * free because it is a real scroll container.
 */
import { useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTeamMembers, TeamCard } from "@/components/sections/team-grid";

/** Desktop track width per card — matches the 5-up grid's card size. */
const CARD_W = 232;

export function TeamCarousel({ limit }: { limit?: number }) {
  const team = useTeamMembers(limit);
  const railRef = useRef<HTMLDivElement>(null);

  const page = useCallback((dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    // Scroll by a whole viewport of cards, clamped by the browser.
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={railRef}
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: `minmax(${CARD_W}px, 1fr)`,
          gap: 16,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          // Never chain the rail's scroll to the page behind it.
          overscrollBehaviorX: "contain",
          scrollbarWidth: "none",
          // Room for the cards' hover lift/shadow, which would otherwise clip.
          padding: "12px 4px 20px",
          perspective: 1400,
        }}
      >
        {team.map((member) => (
          <div
            key={member.name}
            style={{ scrollSnapAlign: "start", minWidth: 0 }}
          >
            <TeamCard member={member} />
          </div>
        ))}
      </div>

      <RailButton side="left" onClick={() => page(-1)} />
      <RailButton side="right" onClick={() => page(1)} />
    </div>
  );
}

function RailButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        side === "left" ? "Previous team members" : "Next team members"
      }
      style={{
        position: "absolute",
        top: "40%",
        [side]: -18,
        width: 40,
        height: 40,
        borderRadius: "var(--r-pill)",
        border: "1px solid var(--color-border-field)",
        background: "var(--color-surface)",
        color: "var(--color-brand-deep)",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)",
        zIndex: 20,
      }}
    >
      {side === "left" ? (
        <ChevronLeft size={20} aria-hidden />
      ) : (
        <ChevronRight size={20} aria-hidden />
      )}
    </button>
  );
}
