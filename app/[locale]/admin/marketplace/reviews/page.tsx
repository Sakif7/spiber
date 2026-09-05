import { setRequestLocale } from "next-intl/server";
import { MessageSquare } from "lucide-react";
import { ReviewModeration } from "@/components/admin/review-moderation";
import { RatingStars } from "@/components/marketplace/rating-stars";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusFilterPills } from "@/components/admin/ui/status-filter";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="space-y-4">
      <AdminPageHeader
        title="Reviews"
        description="Moderate Spiber Kart product reviews. Approved reviews count towards the product rating."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusFilterPills
          statuses={STATUSES}
          active={active}
          basePath="/admin/marketplace/reviews"
          allValue="pending"
          label="Status"
        />
        <span className="text-muted-foreground text-xs tabular-nums">
          {reviews.length} {active} review{reviews.length === 1 ? "" : "s"}
        </span>
      </div>

      {reviews.length === 0 ? (
        <Card className="items-center py-10 text-center">
          <MessageSquare className="text-muted-foreground size-6" />
          <p className="text-foreground text-sm font-medium">
            No {active} reviews.
          </p>
          <p className="text-muted-foreground text-[13px]">
            {active === "pending"
              ? "New customer reviews wait here until you approve or reject them."
              : "Switch the status filter to see other reviews."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {reviews.map((r) => (
            <Card key={String(r._id)} className="gap-0 py-4">
              <CardContent className="space-y-2 px-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <RatingStars value={r.rating} showCount={false} />
                  <span className="text-foreground font-semibold">
                    {r.authorName}
                  </span>
                  {r.verifiedPurchase && (
                    <span className="text-xs font-semibold text-[var(--color-success)]">
                      ✓ Verified purchase
                    </span>
                  )}
                  <span className="text-muted-foreground text-xs">
                    · {names.get(String(r.productId)) ?? "Product"}
                  </span>
                  <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString("en-GB")}
                  </span>
                </div>
                {r.title && (
                  <p className="text-foreground text-sm font-semibold">
                    {r.title}
                  </p>
                )}
                <p className="text-foreground text-[13px] whitespace-pre-line">
                  {r.body}
                </p>
                {active === "pending" && (
                  <div className="pt-1">
                    <ReviewModeration reviewId={String(r._id)} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
