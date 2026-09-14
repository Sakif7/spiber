import mongoose, { Schema, type Model, type Types } from "mongoose";
import type {
  DocumentBody,
  DocumentSettings,
} from "@/lib/schemas/authored-document";
import type { DocumentStatus, DocumentType } from "@/lib/documents/types";

/**
 * A written document — a notice, a letter, a memo, an agreement — authored
 * in the admin's editor. The living text is `body` (TipTap JSON); every
 * filing (a manual snapshot, sending, completion) appends an immutable
 * `versions[]` entry whose PDF lives encrypted in the vault.
 *
 * Recipients and comments are here from the start so the rows never need
 * a migration when signing and review arrive; they stay empty until then.
 */
export interface IDocumentVersion {
  n: number;
  label: "snapshot" | "sent" | "completed" | "reissued";
  note?: string | null;
  body: DocumentBody;
  /** The vault file (CompanyDocument) holding the PDF, when filed. */
  vaultFileId?: Types.ObjectId | string | null;
  pdfSha256?: string | null;
  pages?: number | null;
  createdAt: Date;
  createdBy?: Types.ObjectId | string | null;
}

export interface IDocumentRecipient {
  employeeId: Types.ObjectId | string;
  /** What is asked of them: a signature in their slot, or a read receipt. */
  role: "sign" | "acknowledge";
  status: "pending" | "acknowledged" | "signed";
  actedAt?: Date | null;
  /** The signature image used, frozen at signing time. */
  signatureAssetId?: Types.ObjectId | string | null;
  typedName?: string | null;
  ip?: string | null;
}

export interface IDocumentComment {
  id: string;
  /** The `comment` mark id the thread is anchored to; null once the text is gone. */
  anchorId?: string | null;
  quote?: string | null;
  authorId: Types.ObjectId | string;
  text: string;
  createdAt: Date;
  resolvedAt?: Date | null;
  resolvedBy?: Types.ObjectId | string | null;
}

export interface IDocumentEvent {
  at: Date;
  actorId?: Types.ObjectId | string | null;
  action: string;
  note?: string | null;
}

export interface IAuthoredDocument {
  type: DocumentType;
  /** Assigned when sent; null while a draft. */
  number?: string | null;
  title: string;
  status: DocumentStatus;
  authorId: Types.ObjectId | string;
  body: DocumentBody;
  /** Bumped on every save so a stale editor tab cannot overwrite a newer one. */
  rev: number;
  settings: DocumentSettings;
  /** For a letter: the employee whose details fill the merge fields. */
  mergeEmployeeId?: Types.ObjectId | string | null;
  recipients: IDocumentRecipient[];
  comments: IDocumentComment[];
  versions: IDocumentVersion[];
  activity: IDocumentEvent[];
  sentAt?: Date | null;
  completedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const versionSchema = new Schema<IDocumentVersion>(
  {
    n: { type: Number, required: true },
    label: {
      type: String,
      enum: ["snapshot", "sent", "completed", "reissued"],
      required: true,
    },
    note: { type: String },
    body: { type: Schema.Types.Mixed, required: true },
    vaultFileId: { type: Schema.Types.ObjectId, ref: "CompanyDocument" },
    pdfSha256: { type: String },
    pages: { type: Number },
    createdAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false },
);

const recipientSchema = new Schema<IDocumentRecipient>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    role: { type: String, enum: ["sign", "acknowledge"], required: true },
    status: {
      type: String,
      enum: ["pending", "acknowledged", "signed"],
      default: "pending",
    },
    actedAt: { type: Date },
    signatureAssetId: { type: Schema.Types.ObjectId, ref: "PdfAsset" },
    typedName: { type: String },
    ip: { type: String },
  },
  { _id: false },
);

const commentSchema = new Schema<IDocumentComment>(
  {
    id: { type: String, required: true },
    anchorId: { type: String },
    quote: { type: String },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, required: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false },
);

const eventSchema = new Schema<IDocumentEvent>(
  {
    at: { type: Date, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    note: { type: String },
  },
  { _id: false },
);

const authoredDocumentSchema = new Schema<IAuthoredDocument>(
  {
    type: {
      type: String,
      enum: ["notice", "letter", "memo", "agreement"],
      required: true,
      index: true,
    },
    number: { type: String, unique: true, sparse: true },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "in_review", "sent", "completed", "void"],
      default: "draft",
      index: true,
    },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: Schema.Types.Mixed, required: true },
    rev: { type: Number, default: 0 },
    settings: { type: Schema.Types.Mixed, required: true },
    mergeEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    recipients: { type: [recipientSchema], default: [] },
    comments: { type: [commentSchema], default: [] },
    versions: { type: [versionSchema], default: [] },
    activity: { type: [eventSchema], default: [] },
    sentAt: { type: Date },
    completedAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { collection: "authored_documents", timestamps: true, minimize: false },
);

authoredDocumentSchema.index({ deletedAt: 1, status: 1, updatedAt: -1 });
authoredDocumentSchema.index({ title: "text" });

export const AuthoredDocument: Model<IAuthoredDocument> =
  (mongoose.models.AuthoredDocument as Model<IAuthoredDocument>) ??
  mongoose.model<IAuthoredDocument>("AuthoredDocument", authoredDocumentSchema);
