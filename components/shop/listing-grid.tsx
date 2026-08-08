import type { ReactNode } from "react";

/** Shared listing CSS (inline <style>, no globals.css edit needed): the dense
 * auto-fill grid, phone 2-up override, and list-row hover/responsive rules. */
const LISTING_CSS = `
  .listing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(238px, 1fr));
    gap: var(--s-4);
  }
  @media (max-width: 640px) {
    .listing-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--s-3);
    }
  }
  .plr-row:hover {
    box-shadow: var(--shadow-brand);
    border-color: var(--teal-300);
  }
  @media (max-width: 760px) {
    .plr-row { flex-wrap: wrap; }
    .plr-media { width: 100% !important; height: 160px; }
    .plr-side {
      border-left: 0 !important;
      padding-left: 0 !important;
      flex-direction: row !important;
      justify-content: space-between !important;
      width: 100%;
      align-items: center !important;
    }
  }
`;

/**
 * Dense auto-filling grid for the full-width listing pages: as many ~250px
 * cards per row as the viewport allows (Ryans-style), 2-up on phones.
 */
export function ListingGrid({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{LISTING_CSS}</style>
      <div className="listing-grid">{children}</div>
    </>
  );
}

/** Vertical stack for the list view. */
export function ListingRows({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{LISTING_CSS}</style>
      <div style={{ display: "grid", gap: "var(--s-4)" }}>{children}</div>
    </>
  );
}
