import type { CSSProperties, ReactNode } from "react";

/**
 * Responsive card grid. `columns` hooks into the `.equal-Ncol` breakpoints
 * already defined in globals.css (collapses to 1–2 columns on small screens).
 */
export function CardGrid({
  children,
  columns = 3,
  gap = 24,
  style,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`equal-${columns}col`}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
