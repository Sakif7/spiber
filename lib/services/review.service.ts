import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Order } from "@/lib/models/order";
import { Product, type IProduct } from "@/lib/models/product";
import type { Lean } from "@/lib/models/_shared";
import {
  createReview,
  recomputeProductRating,
  setReviewStatus,
  userHasReviewed,
} from "@/lib/repositories/reviews.repo";
import type { ReviewCreateInput, ReviewStatus } from "@/lib/schemas/review";
import { localize } from "@/lib/schemas/localized";
import { notifyAdmins } from "./notification.service";

export type SubmitReviewResult =
  | { ok: true }
  | { ok: false; code: "product_unavailable" | "already_reviewed" };

/** Whether the user has a non-cancelled order containing the product. */
async function hasPurchased(
  userId: string,
  productId: string,
): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(productId))
    return false;
  const exists = await Order.exists({
    userId,
    "items.productId": productId,
    status: { $nin: ["cancelled", "refunded"] },
  });
  return Boolean(exists);
}

export async function submitReview(
  userId: string,
  authorName: string,
  input: ReviewCreateInput,
): Promise<SubmitReviewResult> {
  await connectToDatabase();
  const product = await Product.findOne({
    _id: input.productId,
    storefront: "marketplace",
    deletedAt: null,
  })
    .lean<Lean<IProduct>>()
    .exec();
  if (!product) return { ok: false, code: "product_unavailable" };

  if (await userHasReviewed(userId, input.productId)) {
    return { ok: false, code: "already_reviewed" };
  }

  const verifiedPurchase = await hasPurchased(userId, input.productId);
  try {
    await createReview({
      productId: new mongoose.Types.ObjectId(input.productId),
      userId: new mongoose.Types.ObjectId(userId),
      authorName,
      rating: input.rating,
      title: input.title,
      body: input.body,
      verifiedPurchase,
      status: "pending",
    });
  } catch (e: unknown) {
    // Unique (userId, productId) race — treat as already reviewed.
    if (
      typeof e === "object" &&
      e &&
      "code" in e &&
      (e as { code?: number }).code === 11000
    ) {
      return { ok: false, code: "already_reviewed" };
    }
    throw e;
  }
  await notifyAdmins({
    type: "review.submitted",
    severity: "info",
    title: "New review awaiting moderation",
    body: `${"★".repeat(input.rating)} · ${localize(product.name, "en")} · ${authorName}`,
    href: "/admin/marketplace/reviews",
    entity: { kind: "Review", ref: localize(product.name, "en") },
  });
  return { ok: true };
}

export type ModerateReviewResult =
  | { ok: true }
  | { ok: false; code: "not_found" };

export async function moderateReview(
  id: string,
  status: ReviewStatus,
): Promise<ModerateReviewResult> {
  await connectToDatabase();
  const updated = await setReviewStatus(id, status);
  if (!updated) return { ok: false, code: "not_found" };
  await recomputeProductRating(String(updated.productId));
  return { ok: true };
}
