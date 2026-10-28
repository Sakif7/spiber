import mongoose, { Schema, type Model } from "mongoose";
import type {
  TravelRequestStatus,
  TravelRequestType,
} from "@/lib/schemas/travel-request";
import { tourismPaymentDef, type ITourismPayment } from "./_shared";

export interface ITravelRequestQuote {
  amountMinor?: number | null;
  /** What the traveller may pay online now (staff choose, whole taka). */
  collectOnlineMinor?: number | null;
  note?: string | null;
  sentAt?: Date | null;
}

export interface ITravelRequestActivity {
  authorId: mongoose.Types.ObjectId | string;
  body: string;
  at: Date;
}

export interface ITravelRequest {
  travelRequestNumber: string;
  type: TravelRequestType;
  details: Record<string, unknown>;
  linkedCaseId?: mongoose.Types.ObjectId | string | null;
  contact: { name: string; email: string; phone: string };
  provider: string;
  status: TravelRequestStatus;
  quote?: ITravelRequestQuote | null;
  /** Collected online through the quote's pay link. */
  payment?: ITourismPayment | null;
  /** Passed on to the airline / hotel / embassy: the cost in the report. */
  passedOnMinor?: number | null;
  assignedTo?: mongoose.Types.ObjectId | string | null;
  activity: ITravelRequestActivity[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const travelRequestSchema = new Schema<ITravelRequest>(
  {
    travelRequestNumber: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["air", "hotel", "visa", "transfer"],
      required: true,
      index: true,
    },
    details: { type: Schema.Types.Mixed, default: {} },
    linkedCaseId: {
      type: Schema.Types.ObjectId,
      ref: "MedicalCase",
      default: null,
      index: true,
    },
    contact: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
    },
    provider: { type: String, default: "manual" },
    status: {
      type: String,
      enum: ["new", "quoted", "confirmed", "closed", "cancelled"],
      default: "new",
      index: true,
    },
    quote: {
      type: new Schema<ITravelRequestQuote>(
        {
          amountMinor: { type: Number, default: null, min: 0 },
          collectOnlineMinor: { type: Number, default: null, min: 0 },
          note: { type: String, default: null },
          sentAt: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    payment: {
      type: new Schema<ITourismPayment>(tourismPaymentDef, { _id: false }),
      default: null,
    },
    passedOnMinor: { type: Number, default: null, min: 0 },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    activity: {
      type: [
        new Schema<ITravelRequestActivity>(
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
    deletedAt: { type: Date, default: null },
  },
  { collection: "tourism_travel_requests", timestamps: true },
);

travelRequestSchema.index({ status: 1, createdAt: -1 });
travelRequestSchema.index({ type: 1, status: 1, createdAt: -1 });
// The report and revenue: requests paid in a window.
travelRequestSchema.index({ "payment.status": 1, "payment.paidAt": 1 });

export const TravelRequest: Model<ITravelRequest> =
  (mongoose.models.TravelRequest as Model<ITravelRequest>) ??
  mongoose.model<ITravelRequest>("TravelRequest", travelRequestSchema);
