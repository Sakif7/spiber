import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * A file in the company document vault (super-admin only). The binary lives in
 * PRIVATE storage as an AES-256-GCM-encrypted blob (see lib/crypto/vault.ts);
 * this row holds the plaintext metadata. Streamed exclusively through the
 * audited /api/media/company-document route — never a public URL.
 */
export interface ICompanyDocument {
  title: string;
  originalFilename: string;
  /** RAW PRIVATE STORAGE KEY of the encrypted blob — never sent to clients. */
  fileKey: string;
  /** Real MIME type of the decrypted file (stored blob is octet-stream). */
  contentType: string;
  /** Plaintext size in bytes. */
  size: number;
  folder?: string;
  uploadedBy: Types.ObjectId | string;
  uploadedByEmail?: string;
  encrypted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const companyDocumentSchema = new Schema<ICompanyDocument>(
  {
    title: { type: String, required: true, trim: true },
    originalFilename: { type: String, required: true },
    fileKey: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    folder: { type: String, trim: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploadedByEmail: { type: String },
    encrypted: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { collection: "company_documents", timestamps: true },
);

companyDocumentSchema.index({ deletedAt: 1, createdAt: -1 });
companyDocumentSchema.index({ folder: 1 });

export const CompanyDocument: Model<ICompanyDocument> =
  (mongoose.models.CompanyDocument as Model<ICompanyDocument>) ??
  mongoose.model<ICompanyDocument>("CompanyDocument", companyDocumentSchema);
