import mongoose, { Schema, type Model } from "mongoose";

/**
 * A global admin notification — one row per business event (new order, RFQ,
 * enrollment, lead, …), shared by every admin. Read state is per-admin via
 * `readBy` (user-id strings), so one admin marking a row read doesn't clear
 * it for the others. Written best-effort from the domain services (a failed
 * notification must never fail the business action).
 */
export interface IAdminNotification {
  /** Event discriminator, e.g. "order.placed", "quotation.submitted". */
  type: string;
  title: string;
  body?: string;
  /** Locale-less admin path the bell navigates to, e.g. "/admin/orders/SPM-…". */
  href: string;
  severity: "info" | "success" | "warning";
  /** What the event is about (kind + human reference, e.g. order number). */
  entity?: { kind: string; id?: string; ref?: string };
  readBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

const adminNotificationSchema = new Schema<IAdminNotification>(
  {
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String },
    href: { type: String, required: true },
    severity: {
      type: String,
      enum: ["info", "success", "warning"],
      default: "info",
    },
    entity: {
      type: new Schema(
        { kind: String, id: String, ref: String },
        { _id: false },
      ),
      default: undefined,
    },
    readBy: { type: [String], default: [] },
  },
  { collection: "admin_notifications", timestamps: true },
);

adminNotificationSchema.index({ createdAt: -1 });
// Notifications are ephemeral signals, not records — expire after 60 days.
adminNotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 24 * 60 * 60 },
);

export const AdminNotification: Model<IAdminNotification> =
  (mongoose.models.AdminNotification as Model<IAdminNotification>) ??
  mongoose.model<IAdminNotification>(
    "AdminNotification",
    adminNotificationSchema,
  );
