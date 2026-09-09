import mongoose, { Schema, type Model } from "mongoose";
import {
  localizedDef,
  localizedOptionalDef,
  type LocalizedDoc,
} from "./_shared";
import type {
  ProductStatus,
  ProductApprovalStatus,
  Storefront,
} from "@/lib/schemas/catalog";

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
  /** Committed to a sales order but not yet delivered — see IProduct. */
  reservedQty?: number;
  image?: string;
}

/**
 * Seller-submitted content changes to an APPROVED listing, held for re-review
 * while the last-approved version keeps serving (Amazon-style — an edit never
 * takes a live listing offline). Applied to the live fields on approval.
 * Price/stock/status changes are NOT drafted — they apply immediately.
 */
export interface IPendingDraft {
  name: LocalizedDoc;
  description?: LocalizedDoc;
  categoryId: mongoose.Types.ObjectId | string;
  images: string[];
  specs: ISpec[];
  submittedAt: Date;
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
  /** Optional "was"/RRP price; when > priceMinor the storefront shows a sale. */
  compareAtMinor?: number | null;
  /** Optional negotiation floor; when < priceMinor Medtrade shows a range. */
  floorPriceMinor?: number | null;
  /** What a unit costs us. Copied onto an order line when it sells. */
  costPriceMinor?: number | null;
  stockQty: number;
  /**
   * Stock physically on hand but already promised to an invoiced sales order.
   * It stays in `stockQty` (it has not left the shelf) and is subtracted when
   * working out what is still AVAILABLE to sell, so an online checkout can
   * never take units that are committed to a customer. Delivery moves the
   * quantity out of both fields; cancelling releases it back.
   */
  reservedQty?: number;
  lowStockThreshold: number;
  /** null = default tracking rule (Kart tracked; Medtrade tracked once priced); true/false force it. */
  trackStock?: boolean | null;
  status: ProductStatus;
  featured: boolean;
  variantOptions: IVariantOption[];
  variants: IProductVariant[];
  ratingAvg: number;
  ratingCount: number;
  /** null = platform/house product; else the Seller that owns this listing. */
  sellerId?: mongoose.Types.ObjectId | string | null;
  /** Approval gate for seller-owned listings (house products = "approved"). */
  approvalStatus: ProductApprovalStatus;
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  /** Denormalized from Seller.status — suspended sellers' listings are delisted. */
  sellerSuspended?: boolean;
  /** Content edit awaiting re-review while the approved version stays live. */
  pendingDraft?: IPendingDraft | null;
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
    reservedQty: { type: Number, default: 0, min: 0 },
    image: { type: String },
  },
  { _id: false },
);

const productSchema = new Schema<IProduct>(
  {
    sku: { type: String, required: true, trim: true },
    name: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    // Optional localized trio (the old hand-rolled {en,bn} dropped ja writes).
    description: { ...localizedOptionalDef },
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
    // Optional "was"/RRP price; when > priceMinor the storefront shows a sale.
    compareAtMinor: { type: Number, default: null, min: 0 },
    // Optional negotiation floor; when < priceMinor Medtrade shows a range.
    floorPriceMinor: { type: Number, default: null, min: 0 },
    // What a unit costs us; the basis of gross profit on the sales report.
    costPriceMinor: { type: Number, default: null, min: 0 },
    stockQty: { type: Number, default: 0 },
    reservedQty: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    // null = default tracking rule; true/false force stock tracking on/off.
    trackStock: { type: Boolean, default: null },
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
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      default: null,
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    sellerSuspended: { type: Boolean, default: false },
    pendingDraft: {
      type: new Schema<IPendingDraft>(
        {
          name: { ...localizedDef },
          description: { ...localizedOptionalDef },
          categoryId: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
          },
          images: { type: [String], default: [] },
          specs: { type: [specSchema], default: [] },
          submittedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
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
