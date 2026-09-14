import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * An image a PDF template can stamp onto a page — the company seal, the MD's
 * signature, the name stamp.
 *
 * These are effectively the company's signature, so the bytes are stored
 * AES-GCM-encrypted in private storage (the vault cipher) and only ever
 * decrypted in memory to draw a document or to show the editor a thumbnail.
 * Soft-deleted; a delete is refused while any template still refers to it.
 */
export interface IPdfAsset {
  name: string;
  /**
   * `stamp` (default): a seal/signature a PDF template may place.
   * `signature`: one employee's own signature, filled into document slots
   * when they sign — stored the same way, never offered to templates.
   */
  kind?: "stamp" | "signature";
  /** Storage key of the encrypted blob. */
  fileKey: string;
  contentType: string;
  size: number;
  /** Pixel dimensions, so a stamp keeps its aspect ratio at any width. */
  width: number;
  height: number;
  createdBy: Types.ObjectId | string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const pdfAssetSchema = new Schema<IPdfAsset>(
  {
    name: { type: String, required: true },
    kind: { type: String, enum: ["stamp", "signature"], default: "stamp" },
    fileKey: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date, default: null },
  },
  { collection: "pdf_assets", timestamps: true },
);

pdfAssetSchema.index({ deletedAt: 1, createdAt: -1 });

export const PdfAsset: Model<IPdfAsset> =
  (mongoose.models.PdfAsset as Model<IPdfAsset>) ??
  mongoose.model<IPdfAsset>("PdfAsset", pdfAssetSchema);
