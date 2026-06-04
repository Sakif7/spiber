import mongoose, { Schema, type Model } from "mongoose";
import type { ReviewStatus } from "@/lib/schemas/review";

export interface IReview {
  productId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  authorName: string;
  rating: number;
  title?: string;
  body: string;
  verifiedPurchase: boolean;
  status: ReviewStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String },
    body: { type: String, required: true },
    verifiedPurchase: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "reviews", timestamps: true },
);

// Public list (approved, newest first) + moderation queue.
reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });
// One review per user per product (among non-deleted).
reviewSchema.index(
  { userId: 1, productId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

export const Review: Model<IReview> =
  (mongoose.models.Review as Model<IReview>) ??
  mongoose.model<IReview>("Review", reviewSchema);
