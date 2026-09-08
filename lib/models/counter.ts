import mongoose, { Schema, type Model } from "mongoose";

/**
 * Named monotonic counters.
 *
 * The only current use is the sales invoice sequence, which must never repeat
 * or go backwards: an invoice number is a legal reference a client and the tax
 * authority both hold. `findOneAndUpdate` with `$inc` is atomic, so two admins
 * invoicing at the same moment always get different numbers.
 */
export interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: "counters", versionKey: false },
);

export const Counter: Model<ICounter> =
  (mongoose.models.Counter as Model<ICounter>) ??
  mongoose.model<ICounter>("Counter", counterSchema);
