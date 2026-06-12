import { Children, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Showcase rail that is a normal responsive GRID on desktop/tablet and becomes
 * a horizontal swipe carousel (CSS scroll-snap) on phones — so featured content
 * (destinations, leadership, "you may also like") reads as a swipeable rail
 * instead of a tall single-column stack. Dependency-free and motion-safe
 * (scroll-snap is user-driven; nothing animates), so it needs no
 * `prefers-reduced-motion` guard. All responsive behaviour lives in the
 * `.swipe-rail*` rules in globals.css.
 *
 * `columns` sets the desktop column count; `itemMinWidth` sets each card's width
 * in the mobile rail (cards peek to signal there's more to swipe).
 */
export function SwipeRail({
  children,
  columns = 4,
  gap = 20,
  itemMinWidth = 250,
  className,
  style,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
  gap?: number;
  itemMinWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn("swipe-rail", `swipe-rail-${columns}`, className)}
      style={
        {
          "--rail-gap": `${gap}px`,
          "--rail-item": `${itemMinWidth}px`,
          gap,
          ...style,
        } as CSSProperties
      }
    >
      {Children.map(children, (child, i) => (
        <div className="swipe-rail__item" key={i}>
          {child}
        </div>
      ))}
    </div>
  );
}
