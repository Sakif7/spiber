import mongoose, { Schema, type Model } from "mongoose";
import type {
  ChecklistKey,
  MedicalCaseStatus,
} from "@/lib/schemas/medical-case";
import { tourismPaymentDef, type ITourismPayment } from "./_shared";

export interface IMedicalCaseDocument {
  name: string;
  /** RAW PRIVATE STORAGE KEY — never a public URL, never returned to patients. */
  fileKey: string;
  contentType?: string;
  uploadedAt: Date;
}

export interface IMedicalCaseQuotation {
  amountMinor?: number | null;
  /**
   * What the patient may pay online now — the whole quote, an advance or only
   * our fee (staff choose, whole taka). Null: no online payment offered.
   */
  collectOnlineMinor?: number | null;
  validUntil?: Date | null;
  notes?: string | null;
  sentAt?: Date | null;
}

export interface IChecklistItem {
  done: boolean;
  note?: string;
}
export type IArrangementChecklist = Record<ChecklistKey, IChecklistItem>;

export interface IMedicalCaseActivity {
  authorId: mongoose.Types.ObjectId | string;
  body: string;
  at: Date;
}

export interface IMedicalCase {
  caseNumber: string;
  patient: { name: string; country: string; email: string; phone: string };
  userId?: mongoose.Types.ObjectId | string | null;
  diagnosis?: string;
  requestedService?: string;
  documents: IMedicalCaseDocument[];
  hospitalId?: mongoose.Types.ObjectId | string | null;
  doctorId?: mongoose.Types.ObjectId | string | null;
  packageId?: mongoose.Types.ObjectId | string | null;
  status: MedicalCaseStatus;
  quotation?: IMedicalCaseQuotation | null;
  /** Collected online through the quote's pay link. */
  payment?: ITourismPayment | null;
  /**
   * What we pass on to the hospital out of what we collected — the case's
   * cost in the sales report, "missing" until staff type it.
   */
  passedOnMinor?: number | null;
  assignedTo?: mongoose.Types.ObjectId | string | null;
  arrangementChecklist: IArrangementChecklist;
  activity: IMedicalCaseActivity[];
  consentAcceptedAt: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const checklistItemSchema = () =>
  new Schema<IChecklistItem>(
    { done: { type: Boolean, default: false }, note: { type: String } },
    { _id: false },
  );

const medicalCaseSchema = new Schema<IMedicalCase>(
  {
    caseNumber: { type: String, required: true, unique: true },
    patient: {
      name: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    diagnosis: { type: String },
    requestedService: { type: String },
    documents: {
      type: [
        new Schema<IMedicalCaseDocument>(
          {
            name: { type: String, required: true },
            fileKey: { type: String, required: true },
            contentType: { type: String },
            uploadedAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", default: null },
    doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", default: null },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: "TreatmentPackage",
      default: null,
    },
    status: {
      type: String,
      enum: [
        "new",
        "reviewing",
        "quoted",
        "confirmed",
        "arranging",
        "in_treatment",
        "follow_up",
        "closed",
        "lost",
      ],
      default: "new",
      index: true,
    },
    quotation: {
      type: new Schema<IMedicalCaseQuotation>(
        {
          amountMinor: { type: Number, default: null, min: 0 },
          collectOnlineMinor: { type: Number, default: null, min: 0 },
          validUntil: { type: Date, default: null },
          notes: { type: String, default: null },
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
    arrangementChecklist: {
      appointment: {
        type: checklistItemSchema(),
        default: () => ({ done: false }),
      },
      visa: { type: checklistItemSchema(), default: () => ({ done: false }) },
      airTicket: {
        type: checklistItemSchema(),
        default: () => ({ done: false }),
      },
      accommodation: {
        type: checklistItemSchema(),
        default: () => ({ done: false }),
      },
      airportTransfer: {
        type: checklistItemSchema(),
        default: () => ({ done: false }),
      },
    },
    activity: {
      type: [
        new Schema<IMedicalCaseActivity>(
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
    consentAcceptedAt: { type: Date, required: true },
    deletedAt: { type: Date, default: null },
  },
  { collection: "tourism_medical_cases", timestamps: true },
);

medicalCaseSchema.index({ status: 1, createdAt: -1 });
medicalCaseSchema.index({ assignedTo: 1, status: 1 });
// The report and revenue: cases paid in a window.
medicalCaseSchema.index({ "payment.status": 1, "payment.paidAt": 1 });

export const MedicalCase: Model<IMedicalCase> =
  (mongoose.models.MedicalCase as Model<IMedicalCase>) ??
  mongoose.model<IMedicalCase>("MedicalCase", medicalCaseSchema);
