import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";

export interface IBrand {
  name: LocalizedDoc;
  slug: string;
  logo?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<IBrand>(
  {
    name: { ...localizedDef },
    slug: { type: String, required: true, unique: true, trim: true },
    logo: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { collection: "brands", timestamps: true },
);

export const Brand: Model<IBrand> =
  (mongoose.models.Brand as Model<IBrand>) ??
  mongoose.model<IBrand>("Brand", brandSchema);
