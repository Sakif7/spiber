import mongoose, { Schema, type Model } from "mongoose";
import type { ProductRequestStatus } from "@/lib/schemas/product-request";

export interface IProductRequestNote {
  authorId: mongoose.Types.ObjectId | string;
  body: string;
  at: Date;
}

export interface IProductRequest {
  requestNumber: string;
  productName: string;
  category?: string;
  brand?: string;
  quantity?: number;
  budget?: string;
  referenceUrl?: string;
  details?: string;
  name: string;
  email: string;
  phone?: string;
  locale?: string;
  status: ProductRequestStatus;
  assignedTo?: mongoose.Types.ObjectId | string | null;
  notes: IProductRequestNote[];
  createdAt: Date;
  updatedAt: Date;
}

const productRequestSchema = new Schema<IProductRequest>(
  {
    requestNumber: { type: String, required: true, unique: true },
    productName: { type: String, required: true, trim: true },
    category: { type: String },
    brand: { type: String },
    quantity: { type: Number },
    budget: { type: String },
    referenceUrl: { type: String },
    details: { type: String },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String },
    locale: { type: String },
    status: {
      type: String,
      enum: ["new", "reviewing", "sourcing", "quoted", "fulfilled", "declined"],
      default: "new",
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    notes: {
      type: [
        new Schema<IProductRequestNote>(
          {
            authorId: { type: Schema.Types.ObjectId, ref: "User" },
            body: String,
            at: Date,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { collection: "product_requests", timestamps: true },
);

productRequestSchema.index({ status: 1, createdAt: -1 });

export const ProductRequest: Model<IProductRequest> =
  (mongoose.models.ProductRequest as Model<IProductRequest>) ??
  mongoose.model<IProductRequest>("ProductRequest", productRequestSchema);
