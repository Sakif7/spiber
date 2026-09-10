import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { SalesLeadStatus, LeadReason } from "@/lib/schemas/sales-lead";

/**
 * An organisation Spiber Med sells to offline: a hospital, clinic or lab.
 *
 * Distinct from the site's `Inquiry` and `QuotationRequest`, which are inbound
 * web forms. A lead is a relationship the sales team owns and returns to, and
 * it is what a sales order and its invoice number are addressed to.
 */
export interface ISalesLeadActivity {
  authorId: Types.ObjectId | string;
  body: string;
  at: Date;
  from?: string | null;
  to?: string | null;
}

export interface ISalesLead {
  leadNumber: string;
  organisation: string;
  /**
   * Short uppercase code for this client, used in the invoice number
   * (SPIBER/<CODE>/…). Kept on the lead so every invoice to the same hospital
   * carries the same identifier, exactly as the paper invoices did.
   */
  code: string;
  contactName: string;
  phone: string;
  email?: string | null;
  address: string;
  /** District slug (see `lib/bd/districts`). The address alone cannot be filtered. */
  area?: string | null;
  /** Who brought the lead in, when it was one of ours. */
  sourceEmployeeId?: Types.ObjectId | string | null;
  /**
   * The referrer's name as it should read.
   *
   * Set for a typed name, and also snapshotted when an employee is picked, so
   * a list of leads renders without a join per row.
   */
  sourceName?: string | null;
  /** What they are asking for; more than one is normal. */
  reasons?: LeadReason[];
  reasonNote?: string | null;
  /** Defaults for the proposal's "To" block, e.g. "Director" / "Procurement". */
  addresseeTitle?: string | null;
  addresseeDept?: string | null;
  remark?: string | null;
  status: SalesLeadStatus;
  assignedTo?: Types.ObjectId | string | null;
  activity: ISalesLeadActivity[];
  lastActivityAt?: Date | null;
  createdBy: Types.ObjectId | string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<ISalesLeadActivity>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    at: { type: Date, default: Date.now },
    from: { type: String, default: null },
    to: { type: String, default: null },
  },
  { _id: false },
);

const salesLeadSchema = new Schema<ISalesLead>(
  {
    leadNumber: { type: String, required: true, unique: true },
    organisation: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    address: { type: String, required: true, trim: true },
    area: { type: String, default: null, index: true },
    sourceEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    sourceName: { type: String, default: null, trim: true },
    reasons: { type: [String], default: [] },
    reasonNote: { type: String, default: null },
    addresseeTitle: { type: String, default: null },
    addresseeDept: { type: String, default: null },
    remark: { type: String, default: null },
    status: { type: String, required: true, default: "new", index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    activity: { type: [activitySchema], default: [] },
    lastActivityAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date, default: null },
  },
  { collection: "sales_leads", timestamps: true },
);

// One live lead per client code — the code identifies the client on invoices,
// so two organisations must not share one. Partial, so a deleted lead frees it.
salesLeadSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
salesLeadSchema.index({ deletedAt: 1, status: 1, createdAt: -1 });
salesLeadSchema.index({ organisation: 1 });

export const SalesLead: Model<ISalesLead> =
  (mongoose.models.SalesLead as Model<ISalesLead>) ??
  mongoose.model<ISalesLead>("SalesLead", salesLeadSchema);
