import { Star } from "lucide-react";

/** Read-only star rating (server-safe). Renders 5 stars filled to `value`. */
export function RatingStars({
  value,
  count,
  size = 14,
  showCount = true,
}: {
  value: number;
  count?: number;
  size?: number;
  showCount?: boolean;
}) {
  const rounded = Math.round(value * 2) / 2; // nearest half
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      aria-label={`${value.toFixed(1)} out of 5`}
    >
      <span style={{ display: "inline-flex", gap: 1 }} aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = rounded >= i ? 1 : rounded >= i - 0.5 ? 0.5 : 0;
          return (
            <span
              key={i}
              style={{
                position: "relative",
                width: size,
                height: size,
                display: "inline-block",
              }}
            >
              <Star
                size={size}
                strokeWidth={1.6}
                color="var(--color-border)"
                style={{ position: "absolute", inset: 0 }}
              />
              {fill > 0 && (
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${fill * 100}%`,
                    overflow: "hidden",
                  }}
                >
                  <Star
                    size={size}
                    strokeWidth={1.6}
                    color="var(--color-secondary)"
                    fill="var(--color-secondary)"
                  />
                </span>
              )}
            </span>
          );
        })}
      </span>
      {showCount && count != null && count > 0 && (
        <span
          style={{
            fontSize: "var(--fs-caption)",
            color: "var(--color-text-muted)",
          }}
        >
          ({count})
        </span>
      )}
    </span>
  );
}
