import mongoose, { Schema, type Model } from "mongoose";

/**
 * The Instruments "Request for Quotation" list — a cart-like collection of
 * products a buyer intends to request a quote for. Mirrors `Cart` (one per
 * user / per guest) but carries no price/stock (Instruments is quote-only).
 */
export interface IQuoteListItem {
  productId: mongoose.Types.ObjectId;
  variantId?: string | null;
  qty: number;
}

export interface IQuoteList {
  userId?: mongoose.Types.ObjectId | null;
  guestId?: string | null;
  items: IQuoteListItem[];
  createdAt: Date;
  updatedAt: Date;
}

const quoteListItemSchema = new Schema<IQuoteListItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: String, default: null },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const quoteListSchema = new Schema<IQuoteList>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    guestId: { type: String },
    items: { type: [quoteListItemSchema], default: [] },
  },
  { collection: "quote_lists", timestamps: true },
);

// One quote list per user / per guest (same partial-index pattern as Cart).
quoteListSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } },
);
quoteListSchema.index(
  { guestId: 1 },
  { unique: true, partialFilterExpression: { guestId: { $type: "string" } } },
);

export const QuoteList: Model<IQuoteList> =
  (mongoose.models.QuoteList as Model<IQuoteList>) ??
  mongoose.model<IQuoteList>("QuoteList", quoteListSchema);
