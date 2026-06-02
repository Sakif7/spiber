import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { ProductStatus } from "@/lib/schemas/catalog";

export interface ISpec {
  key: LocalizedDoc;
  value: LocalizedDoc;
}

export interface IProduct {
  sku: string;
  name: LocalizedDoc;
  slug: string;
  description?: LocalizedDoc;
  brandId?: mongoose.Types.ObjectId | string | null;
  categoryId: mongoose.Types.ObjectId | string;
  specs: ISpec[];
  images: string[];
  priceMinor: number;
  stockQty: number;
  lowStockThreshold: number;
  status: ProductStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const specSchema = new Schema<ISpec>(
  { key: { ...localizedDef }, value: { ...localizedDef } },
  { _id: false },
);

const productSchema = new Schema<IProduct>(
  {
    sku: { type: String, required: true, unique: true, trim: true },
    name: { ...localizedDef },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { en: { type: String }, bn: { type: String } },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    specs: { type: [specSchema], default: [] },
    images: { type: [String], default: [] },
    priceMinor: { type: Number, required: true, min: 0 },
    stockQty: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "products", timestamps: true },
);

// Search across localized names + SKU.
productSchema.index({ "name.en": "text", "name.bn": "text", sku: "text" });
// Common listing sort/filter.
productSchema.index({ status: 1, categoryId: 1, priceMinor: 1 });

export const Product: Model<IProduct> =
  (mongoose.models.Product as Model<IProduct>) ??
  mongoose.model<IProduct>("Product", productSchema);
