import { getTranslations } from "next-intl/server";
import { RatingStars } from "./rating-stars";
import { bcp47 } from "@/lib/i18n/intl-locale";
import type { Locale } from "@/i18n/routing";

export type ReviewView = {
  id: string;
  authorName: string;
  rating: number;
  title?: string;
  body: string;
  verifiedPurchase: boolean;
  createdAt: string;
};

export async function ReviewList({
  reviews,
  locale,
}: {
  reviews: ReviewView[];
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "reviews" });
  if (reviews.length === 0) {
    return <p style={{ color: "var(--color-text-muted)" }}>{t("none")}</p>;
  }
  const fmt = new Intl.DateTimeFormat(bcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <div style={{ display: "grid", gap: "var(--s-4)" }}>
      {reviews.map((r) => (
        <div
          key={r.id}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-lg)",
            padding: "var(--s-4)",
            background: "var(--color-surface)",
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--s-3)",
              flexWrap: "wrap",
            }}
          >
            <RatingStars value={r.rating} showCount={false} />
            <strong style={{ color: "var(--color-text-strong)" }}>
              {r.authorName}
            </strong>
            {r.verifiedPurchase && (
              <span
                style={{
                  fontSize: "var(--fs-caption)",
                  color: "var(--color-success)",
                  fontWeight: 600,
                }}
              >
                ✓ {t("verified")}
              </span>
            )}
            <span
              style={{
                marginLeft: "auto",
                fontSize: "var(--fs-caption)",
                color: "var(--color-text-muted)",
              }}
            >
              {fmt.format(new Date(r.createdAt))}
            </span>
          </div>
          {r.title && (
            <strong style={{ color: "var(--color-text-strong)" }}>
              {r.title}
            </strong>
          )}
          <p
            style={{
              margin: 0,
              color: "var(--color-text)",
              lineHeight: "var(--lh-body)",
              whiteSpace: "pre-line",
            }}
          >
            {r.body}
          </p>
        </div>
      ))}
    </div>
  );
}
