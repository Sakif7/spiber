import mongoose, { Schema, type Model } from "mongoose";

export interface ISubscriber {
  email: string;
  createdAt: Date;
}

const subscriberSchema = new Schema<ISubscriber>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    collection: "newsletter",
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const Subscriber: Model<ISubscriber> =
  (mongoose.models.Subscriber as Model<ISubscriber>) ??
  mongoose.model<ISubscriber>("Subscriber", subscriberSchema);
