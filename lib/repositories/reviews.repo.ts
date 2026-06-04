import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Review, type IReview } from "@/lib/models/review";
import { Product } from "@/lib/models/product";
import type { Lean } from "@/lib/models/_shared";
import type { ReviewStatus } from "@/lib/schemas/review";

type ReviewFilter = NonNullable<Parameters<typeof Review.countDocuments>[0]>;

export async function createReview(data: Partial<IReview>) {
  await connectToDatabase();
  return Review.create(data);
}

export async function userHasReviewed(userId: string, productId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(productId))
    return false;
  const existing = await Review.findOne({
    userId,
    productId,
    deletedAt: null,
  })
    .select("_id")
    .lean()
    .exec();
  return Boolean(existing);
}

export async function listApprovedByProduct(
  productId: string,
  limit = 20,
): Promise<Lean<IReview>[]> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(productId)) return [];
  return Review.find({ productId, status: "approved", deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Lean<IReview>[]>()
    .exec();
}

export async function listReviewsForModeration(
  status: ReviewStatus = "pending",
  limit = 100,
) {
  await connectToDatabase();
  return Review.find({ status, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Lean<IReview>[]>()
    .exec();
}

export async function getReviewById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Review.findOne({ _id: id, deletedAt: null }).exec();
}

export async function setReviewStatus(id: string, status: ReviewStatus) {
  await connectToDatabase();
  return Review.findByIdAndUpdate(id, { status }, { new: true }).exec();
}

/** Recompute denormalized ratingAvg/ratingCount from APPROVED reviews. */
export async function recomputeProductRating(productId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(productId)) return;
  const rows = await Review.aggregate<{ avg: number; count: number }>([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        status: "approved",
        deletedAt: null,
      },
    },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]).exec();
  const avg = rows[0]?.avg ?? 0;
  const count = rows[0]?.count ?? 0;
  await Product.updateOne(
    { _id: productId },
    { $set: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: count } },
  ).exec();
}

export type ReviewListParams = { status?: ReviewStatus };
export async function countReviews(params: ReviewListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  return Review.countDocuments(q as unknown as ReviewFilter);
}
