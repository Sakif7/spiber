import mongoose, { Schema, type Model } from "mongoose";
import type { ProvisioningStatus } from "@/lib/schemas/systems";

/**
 * A work item for provisioning an external app (e.g. ZenHcare) after a paid
 * purchase. Manual now — the external app's super admin activates the user and
 * an admin marks this done. A future automated provider fills `result`/`status`
 * via the same row, without changing the purchase flow.
 */
export interface IProvisioningTask {
  purchaseId: mongoose.Types.ObjectId | string;
  softwareProductId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  email: string;
  externalApp: string;
  status: ProvisioningStatus;
  provider: string;
  result?: unknown;
  note?: string;
  activatedAt?: Date | null;
  activatedBy?: mongoose.Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

const provisioningTaskSchema = new Schema<IProvisioningTask>(
  {
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "SoftwarePurchase",
      required: true,
    },
    softwareProductId: {
      type: Schema.Types.ObjectId,
      ref: "SoftwareProduct",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    externalApp: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "in_progress", "done", "failed"],
      default: "open",
      index: true,
    },
    provider: { type: String, default: "manual" },
    result: { type: Schema.Types.Mixed },
    note: { type: String },
    activatedAt: { type: Date, default: null },
    activatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { collection: "provisioning_tasks", timestamps: true },
);

// One task per purchase (idempotent fulfillment).
provisioningTaskSchema.index({ purchaseId: 1 }, { unique: true });
provisioningTaskSchema.index({ createdAt: -1 });

export const ProvisioningTask: Model<IProvisioningTask> =
  (mongoose.models.ProvisioningTask as Model<IProvisioningTask>) ??
  mongoose.model<IProvisioningTask>("ProvisioningTask", provisioningTaskSchema);
