import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { ProductStatus, Storefront } from "@/lib/schemas/catalog";

export interface ISpec {
  key: LocalizedDoc;
  value: LocalizedDoc;
}

/** A variant OPTION dimension (e.g. Size → S/M/L), localized for display. */
export interface IVariantOption {
  name: LocalizedDoc;
  values: LocalizedDoc[];
}

/** A concrete purchasable variant with its own price + stock. */
export interface IProductVariant {
  id: string;
  options: { name: string; value: string }[];
  sku: string;
  priceMinorOverride?: number | null;
  stockQty: number;
  image?: string;
}

export interface IProduct {
  sku: string;
  name: LocalizedDoc;
  slug: string;
  description?: LocalizedDoc;
  brandId?: mongoose.Types.ObjectId | string | null;
  categoryId: mongoose.Types.ObjectId | string;
  storefront: Storefront;
  specs: ISpec[];
  images: string[];
  /** null = "Price on request" (instruments) or variant-priced (marketplace). */
  priceMinor: number | null;
  stockQty: number;
  lowStockThreshold: number;
  status: ProductStatus;
  featured: boolean;
  variantOptions: IVariantOption[];
  variants: IProductVariant[];
  ratingAvg: number;
  ratingCount: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const specSchema = new Schema<ISpec>(
  { key: { ...localizedDef }, value: { ...localizedDef } },
  { _id: false },
);

const variantOptionSchema = new Schema<IVariantOption>(
  { name: { ...localizedDef }, values: { type: [localizedDef], default: [] } },
  { _id: false },
);

const productVariantSchema = new Schema<IProductVariant>(
  {
    id: { type: String, required: true },
    options: {
      type: [
        new Schema(
          {
            name: { type: String, required: true },
            value: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    sku: { type: String, required: true, trim: true },
    priceMinorOverride: { type: Number, default: null, min: 0 },
    stockQty: { type: Number, default: 0, min: 0 },
    image: { type: String },
  },
  { _id: false },
);

const productSchema = new Schema<IProduct>(
  {
    sku: { type: String, required: true, trim: true },
    name: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
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
    storefront: {
      type: String,
      enum: ["instruments", "marketplace"],
      required: true,
      default: "marketplace",
      index: true,
    },
    specs: { type: [specSchema], default: [] },
    images: { type: [String], default: [] },
    // null = "Price on request" (instruments) or variant-priced (marketplace).
    priceMinor: { type: Number, default: null, min: 0 },
    stockQty: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },
    featured: { type: Boolean, default: false },
    variantOptions: { type: [variantOptionSchema], default: [] },
    variants: { type: [productVariantSchema], default: [] },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, default: null },
  },
  { collection: "products", timestamps: true },
);

// Unique sku/slug among NON-deleted products (soft-deleted rows free their
// sku/slug for reuse). Partial filter on deletedAt:null.
productSchema.index(
  { sku: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
productSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
// Search across localized names + SKU.
productSchema.index({ "name.en": "text", "name.bn": "text", sku: "text" });
// Storefront-scoped listing/filter/sort.
productSchema.index({ storefront: 1, status: 1, categoryId: 1, priceMinor: 1 });
productSchema.index({ storefront: 1, featured: 1, status: 1 });
productSchema.index({ storefront: 1, status: 1, ratingAvg: -1 });

export const Product: Model<IProduct> =
  (mongoose.models.Product as Model<IProduct>) ??
  mongoose.model<IProduct>("Product", productSchema);
