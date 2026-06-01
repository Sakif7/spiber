import mongoose, { Schema, type Model } from "mongoose";

export interface IQuote {
  name: string;
  email: string;
  org: string;
  phone: string;
  category: string;
  message: string;
  createdAt: Date;
}

const quoteSchema = new Schema<IQuote>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    org: { type: String, default: "" },
    phone: { type: String, default: "" },
    category: { type: String, default: "general", index: true },
    message: { type: String, required: true },
  },
  { collection: "quotes", timestamps: { createdAt: true, updatedAt: false } },
);

export const Quote: Model<IQuote> =
  (mongoose.models.Quote as Model<IQuote>) ??
  mongoose.model<IQuote>("Quote", quoteSchema);
