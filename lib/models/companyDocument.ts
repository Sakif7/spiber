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
  /**
   * LEGACY free-text folder name. Superseded by `folderId`; kept so rows
   * written before the folder tree still read, and migrated by
   * scripts/migrate-company-vault-folders.mjs.
   */
  folder?: string;
  /** Containing folder; null means the vault root. */
  folderId?: Types.ObjectId | null;
  /**
   * Denormalised root→folder chain (the folder's own ancestors plus itself), so
   * "everything under this folder, at any depth" is one indexed query.
   */
  ancestors: Types.ObjectId[];
  /** Lowercased `title`, for case-insensitive uniqueness within a folder. */
  nameLower: string;
  /** Filename extension without the dot, for the icon and type column. */
  ext?: string;
  uploadedBy: Types.ObjectId | string;
  uploadedByEmail?: string;
  modifiedBy?: Types.ObjectId | string | null;
  modifiedByEmail?: string | null;
  encrypted: boolean;
  /** In the trash. Shares the timestamp of the folder trashed with it. */
  trashedAt?: Date | null;
  /** True only on a file the user trashed directly (see CompanyFolder). */
  trashedRoot?: boolean;
  /** Where a restore should put the file back. Null means the vault root. */
  trashedFromFolderId?: Types.ObjectId | null;
  /**
   * Permanently deleted: the encrypted blob is gone from storage and the row
   * survives only as a tombstone, so the audit trail still resolves.
   */
  purgedAt?: Date | null;
  /** Set when the app itself filed the document (e.g. a generated invoice). */
  source?: { kind: string; id: string } | null;
  /** LEGACY soft-delete. `trashedAt` replaces it; migrated across. */
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
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyFolder",
      default: null,
    },
    ancestors: [{ type: Schema.Types.ObjectId, ref: "CompanyFolder" }],
    nameLower: { type: String, required: true, default: "" },
    ext: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploadedByEmail: { type: String },
    modifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    modifiedByEmail: { type: String, default: null },
    encrypted: { type: Boolean, default: true },
    trashedAt: { type: Date, default: null },
    trashedRoot: { type: Boolean, default: false },
    trashedFromFolderId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyFolder",
      default: null,
    },
    purgedAt: { type: Date, default: null },
    source: {
      type: new Schema(
        {
          kind: { type: String, required: true },
          id: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "company_documents", timestamps: true },
);

companyDocumentSchema.index({ deletedAt: 1, createdAt: -1 });
companyDocumentSchema.index({ folder: 1 });
// One live file of a given name per folder; trashed/purged rows free the name.
companyDocumentSchema.index(
  { folderId: 1, nameLower: 1 },
  {
    unique: true,
    partialFilterExpression: { trashedAt: null, purgedAt: null },
  },
);
// Subtree reads (recursive search, folder download, bulk subtree writes).
companyDocumentSchema.index({ ancestors: 1 });
// Listing a folder's children, and the trash view.
companyDocumentSchema.index({ folderId: 1, trashedAt: 1 });
companyDocumentSchema.index({ trashedAt: 1 });
// Back-link from a generated document (invoice, payslip) to its record.
companyDocumentSchema.index({ "source.kind": 1, "source.id": 1 });

export const CompanyDocument: Model<ICompanyDocument> =
  (mongoose.models.CompanyDocument as Model<ICompanyDocument>) ??
  mongoose.model<ICompanyDocument>("CompanyDocument", companyDocumentSchema);
