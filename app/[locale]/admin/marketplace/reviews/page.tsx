import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ReviewModeration } from "@/components/admin/review-moderation";
import { RatingStars } from "@/components/marketplace/rating-stars";
import { listReviewsForModeration } from "@/lib/repositories/reviews.repo";
import { getProductById } from "@/lib/repositories/products.repo";
import { localize } from "@/lib/schemas/localized";
import type { ReviewStatus } from "@/lib/schemas/review";

export const dynamic = "force-dynamic";

const STATUSES: ReviewStatus[] = ["pending", "approved", "rejected"];

export default async function AdminReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);
  const active = (
    STATUSES.includes(status as ReviewStatus) ? status : "pending"
  ) as ReviewStatus;

  let reviews: Awaited<ReturnType<typeof listReviewsForModeration>> = [];
  try {
    reviews = await listReviewsForModeration(active, 100);
  } catch {
    reviews = [];
  }

  // Resolve product names (small N).
  const names = new Map<string, string>();
  await Promise.all(
    [...new Set(reviews.map((r) => String(r.productId)))].map(async (pid) => {
      const p = await getProductById(pid).catch(() => null);
      if (p) names.set(pid, localize(p.name, "en"));
    }),
  );

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-2xl)",
          color: "var(--color-text-strong)",
        }}
      >
        Reviews
      </h1>

      <div style={{ display: "flex", gap: 8 }}>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/marketplace/reviews?status=${s}`}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--r-pill)",
              border: "1px solid var(--color-border)",
              background:
                active === s ? "var(--color-brand)" : "var(--color-surface)",
              color: active === s ? "#fff" : "var(--color-text)",
              fontSize: "var(--fs-caption)",
              textTransform: "capitalize",
              fontWeight: 600,
            }}
          >
            {s}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No {active} reviews.</p>
      ) : (
        <div style={{ display: "grid", gap: "var(--s-4)" }}>
          {reviews.map((r) => (
            <div
              key={String(r._id)}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--r-lg)",
                background: "var(--color-surface)",
                padding: "var(--s-4)",
                display: "grid",
                gap: 8,
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
                    ✓ Verified
                  </span>
                )}
                <span
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: "var(--fs-caption)",
                  }}
                >
                  · {names.get(String(r.productId)) ?? "Product"}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "var(--fs-caption)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              {r.title && <strong>{r.title}</strong>}
              <p
                style={{
                  margin: 0,
                  color: "var(--color-text)",
                  whiteSpace: "pre-line",
                }}
              >
                {r.body}
              </p>
              {active === "pending" && (
                <ReviewModeration reviewId={String(r._id)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
