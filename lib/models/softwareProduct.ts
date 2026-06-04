import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type {
  SoftwarePricingModel,
  DeliveryType,
  SoftwareStatus,
} from "@/lib/schemas/systems";

export interface ISoftwareProduct {
  name: LocalizedDoc;
  slug: string;
  categoryId?: mongoose.Types.ObjectId | string | null;
  description?: LocalizedDoc;
  screenshots: string[];
  features: LocalizedDoc[];
  pricingModel: SoftwarePricingModel;
  priceMinor?: number;
  demoUrl?: string;
  deliveryType: DeliveryType;
  /** Storage key of the downloadable asset (deliveryType "asset"). */
  assetKey?: string;
  /** External system to provision into, e.g. "zenhcare" (deliveryType "external"). */
  externalApp?: string;
  affiliate?: { rateBp: number };
  status: SoftwareStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const softwareProductSchema = new Schema<ISoftwareProduct>(
  {
    name: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    description: { en: { type: String }, bn: { type: String } },
    screenshots: { type: [String], default: [] },
    features: { type: [{ ...localizedDef }], default: [] },
    pricingModel: {
      type: String,
      enum: ["one_time", "subscription", "quote"],
      required: true,
    },
    priceMinor: { type: Number, min: 0 },
    demoUrl: { type: String },
    deliveryType: {
      type: String,
      enum: ["asset", "license", "external"],
      required: true,
      index: true,
    },
    assetKey: { type: String },
    externalApp: { type: String },
    affiliate: { rateBp: { type: Number, min: 0, max: 10000 } },
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "software_products", timestamps: true },
);

// Unique slug among non-deleted products (soft-deleted rows free their slug).
softwareProductSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
softwareProductSchema.index({ "name.en": "text", "name.bn": "text" });
softwareProductSchema.index({ status: 1, createdAt: -1 });

export const SoftwareProduct: Model<ISoftwareProduct> =
  (mongoose.models.SoftwareProduct as Model<ISoftwareProduct>) ??
  mongoose.model<ISoftwareProduct>("SoftwareProduct", softwareProductSchema);
