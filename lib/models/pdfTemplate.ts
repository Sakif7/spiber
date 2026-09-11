import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { Block, TemplateKind, Theme } from "@/lib/schemas/pdf-template";

/**
 * A PDF template, as edited in the admin and as pinned by every document that
 * was drawn with it.
 *
 * One collection holds both the single working draft per kind and every
 * published version. A published row is never updated by any code path —
 * documents record `{ kind, version }` and must re-render the same forever —
 * so "revert" and "reset" only ever copy an old template into the draft.
 */
export interface IPdfTemplate {
  kind: TemplateKind;
  status: "draft" | "published";
  /** Assigned at publish; a draft has none. */
  version: number | null;
  documentTitle: string;
  theme: Theme;
  blocks: Block[];
  note?: string | null;
  /** The published version this draft was loaded from (0 = built-in). */
  baseVersion?: number | null;
  createdBy: Types.ObjectId | string;
  updatedBy?: Types.ObjectId | string | null;
  publishedAt?: Date | null;
  publishedBy?: Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

const pdfTemplateSchema = new Schema<IPdfTemplate>(
  {
    kind: {
      type: String,
      enum: ["proposal", "invoice", "challan", "payslip"],
      required: true,
    },
    status: { type: String, enum: ["draft", "published"], required: true },
    version: { type: Number, default: null },
    documentTitle: { type: String, required: true },
    // Validated by the Zod schema at the boundary; stored as-is.
    theme: { type: Schema.Types.Mixed, required: true },
    blocks: { type: Schema.Types.Mixed, required: true },
    note: { type: String, default: null },
    baseVersion: { type: Number, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { collection: "pdf_templates", timestamps: true },
);

/** Version numbers are unique per kind; the partial filter keeps drafts out. */
pdfTemplateSchema.index(
  { kind: 1, version: -1 },
  { unique: true, partialFilterExpression: { status: "published" } },
);
/** At most one draft per kind, so two tabs cannot fork the working copy. */
pdfTemplateSchema.index(
  { kind: 1 },
  { unique: true, partialFilterExpression: { status: "draft" } },
);

export const PdfTemplate: Model<IPdfTemplate> =
  (mongoose.models.PdfTemplate as Model<IPdfTemplate>) ??
  mongoose.model<IPdfTemplate>("PdfTemplate", pdfTemplateSchema);
