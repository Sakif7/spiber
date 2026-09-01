import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type {
  OrderStatus,
  PaymentStatus,
  PaymentProviderName,
  PaymentMethod,
  Address,
} from "@/lib/schemas/order";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  productSnapshot: {
    name: LocalizedDoc;
    sku: string;
    priceMinor: number;
    image?: string;
    /** null = no variant; else the Product.variants[].id purchased. */
    variantId?: string | null;
    /** Resolved option labels for display, e.g. [{name:"Size",value:"M"}]. */
    variantOptions?: { name: string; value: string }[];
    /** null = platform/house product; else the Seller that owns it (for payouts). */
    sellerId?: mongoose.Types.ObjectId | string | null;
  };
  qty: number;
  lineTotalMinor: number;
}

export interface IPaymentRef {
  provider: PaymentProviderName;
  txnId?: string;
  status: PaymentStatus;
  raw?: unknown;
  paidAt?: Date | null;
  refundedAt?: Date | null;
  /**
   * Commercial arrangement (offline | cod | credit). Legacy orders predate the
   * field, so ALWAYS read it as `payment.method ?? "offline"` — `.lean()`
   * reads do not apply Mongoose defaults.
   */
  method?: PaymentMethod;
  /** Credit only: agreed net terms, snapshotted from the account. */
  termsDays?: number | null;
  /** Credit only: when the invoice falls due (placedAt + termsDays). */
  dueAt?: Date | null;
}

export interface ITimelineEntry {
  status: OrderStatus;
  at: Date;
  /** Customer-visible note (rendered on the customer's order timeline). */
  note?: string;
  /** Admin-only note — never serialized to customer/guest views. */
  internalNote?: string;
}

export interface IRefundRequest {
  reason: string;
  requestedAt: Date;
  /** open → resolved when an admin cancels or refunds the order. */
  status: "open" | "resolved";
}

export interface IOrder {
  orderNumber: string;
  userId?: mongoose.Types.ObjectId | null;
  email: string;
  items: IOrderItem[];
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  /** VAT rate actually applied, in basis points (null = no VAT charged). */
  taxRateBp?: number | null;
  /** AIT rate to DISPLAY on the invoice, in basis points. Never charged. */
  aitRateBp?: number | null;
  discountMinor: number;
  totalMinor: number;
  currency: "BDT";
  status: OrderStatus;
  payment: IPaymentRef;
  shippingAddress: Address;
  couponCode?: string;
  note?: string;
  trackingNumber?: string;
  refundRequest?: IRefundRequest | null;
  storefront: "instruments" | "marketplace";
  idempotencyKey: string;
  timeline: ITimelineEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productSnapshot: {
      name: { ...localizedDef },
      sku: { type: String, required: true },
      priceMinor: { type: Number, required: true },
      image: { type: String },
      variantId: { type: String, default: null },
      variantOptions: {
        type: [
          new Schema(
            { name: { type: String }, value: { type: String } },
            { _id: false },
          ),
        ],
        default: [],
      },
      sellerId: { type: Schema.Types.ObjectId, ref: "Seller", default: null },
    },
    qty: { type: Number, required: true, min: 1 },
    lineTotalMinor: { type: Number, required: true },
  },
  { _id: false },
);

const addressSchema = new Schema<Address>(
  {
    label: String,
    line1: { type: String, required: true },
    line2: String,
    city: { type: String, required: true },
    district: { type: String, required: true },
    postalCode: String,
    phone: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    items: { type: [orderItemSchema], required: true },
    subtotalMinor: { type: Number, required: true },
    shippingMinor: { type: Number, default: 0 },
    taxMinor: { type: Number, default: 0 },
    // Snapshotted at placement so an invoice always reprints the rates that
    // were in force, even after an admin changes the settings.
    taxRateBp: { type: Number, default: null },
    aitRateBp: { type: Number, default: null },
    discountMinor: { type: Number, default: 0 },
    totalMinor: { type: Number, required: true },
    currency: { type: String, default: "BDT" },
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      default: "pending",
      index: true,
    },
    payment: {
      provider: {
        type: String,
        enum: ["manual", "sslcommerz", "aamarpay", "stripe"],
        default: "manual",
      },
      txnId: String,
      status: {
        type: String,
        enum: ["unpaid", "paid", "failed", "refunded"],
        default: "unpaid",
      },
      raw: Schema.Types.Mixed,
      paidAt: { type: Date, default: null },
      refundedAt: { type: Date, default: null },
      method: {
        type: String,
        enum: ["offline", "cod", "credit"],
        default: "offline",
      },
      termsDays: { type: Number, default: null },
      dueAt: { type: Date, default: null },
    },
    shippingAddress: { type: addressSchema, required: true },
    couponCode: String,
    note: String,
    trackingNumber: String,
    refundRequest: {
      type: new Schema<IRefundRequest>(
        {
          reason: { type: String, required: true },
          requestedAt: { type: Date, required: true },
          status: {
            type: String,
            enum: ["open", "resolved"],
            default: "open",
          },
        },
        { _id: false },
      ),
      default: null,
    },
    storefront: {
      type: String,
      enum: ["instruments", "marketplace"],
      default: "marketplace",
      index: true,
    },
    idempotencyKey: { type: String, required: true },
    timeline: {
      type: [
        new Schema<ITimelineEntry>(
          { status: String, at: Date, note: String, internalNote: String },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { collection: "orders", timestamps: true },
);

// Idempotent order creation: same key never creates two orders.
orderSchema.index({ idempotencyKey: 1 }, { unique: true });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ storefront: 1, status: 1, createdAt: -1 });

export const Order: Model<IOrder> =
  (mongoose.models.Order as Model<IOrder>) ??
  mongoose.model<IOrder>("Order", orderSchema);
