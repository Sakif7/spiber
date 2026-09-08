import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * A director's trip out — a marketing call, a lead-generation visit, a meeting
 * at a hospital.
 *
 * It exists so a cost has somewhere to hang and so a trip can be traced to the
 * deal it produced: `leadId` links the visit to the `SalesLead` it was for, and
 * `attendees` records everyone who went, because a lunch on the road is often
 * for two.
 */
export interface IVisit {
  /** SPM-VIS-… */
  ref: string;
  /** The day of the visit, stored at the Dhaka day boundary. */
  visitedAt: Date;
  purpose: string;
  organisation?: string | null;
  location?: string | null;
  /** Employees who went. At least one. */
  attendees: (Types.ObjectId | string)[];
  /** The lead this trip was for, when there is one. */
  leadId?: Types.ObjectId | string | null;
  outcome?: string | null;
  notes?: string | null;
  createdBy: Types.ObjectId | string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const visitSchema = new Schema<IVisit>(
  {
    ref: { type: String, required: true, unique: true },
    visitedAt: { type: Date, required: true },
    purpose: { type: String, required: true, trim: true, maxlength: 200 },
    organisation: { type: String, default: null, trim: true, maxlength: 200 },
    location: { type: String, default: null, trim: true, maxlength: 200 },
    attendees: [
      { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    ],
    leadId: { type: Schema.Types.ObjectId, ref: "SalesLead", default: null },
    outcome: { type: String, default: null, trim: true, maxlength: 2000 },
    notes: { type: String, default: null, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "visits" },
);

visitSchema.index({ deletedAt: 1, visitedAt: -1 });
visitSchema.index({ attendees: 1, visitedAt: -1 });
visitSchema.index({ leadId: 1 });

export const Visit: Model<IVisit> =
  (mongoose.models.Visit as Model<IVisit>) ||
  mongoose.model<IVisit>("Visit", visitSchema);
