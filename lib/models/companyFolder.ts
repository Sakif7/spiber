import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * A folder in the company document vault (super-admin only).
 *
 * Folders used to be a free-text string on each document, so there was one flat
 * level and no way to rename or move a group of files. This is a real tree.
 *
 * `ancestors` is the denormalised root→parent chain (excluding self). It is
 * what makes the expensive questions cheap and single-query:
 *   - everything under a folder, at any depth:  { ancestors: id }
 *   - trash/restore/move of a whole subtree:    updateMany({ ancestors: id })
 *   - "is this folder inside itself?":          target.ancestors.includes(id)
 * The cost is that a move must rewrite the chain for the subtree, which is one
 * pipeline update per collection (see company-fs.service).
 */
export interface ICompanyFolder {
  name: string;
  /** Lowercased `name`, so uniqueness within a parent is case-insensitive. */
  nameLower: string;
  parentId: Types.ObjectId | null;
  /** Root-first chain of ancestor ids, excluding this folder. */
  ancestors: Types.ObjectId[];
  /** `ancestors.length` — cheap depth guard without reading the array. */
  depth: number;
  createdBy: Types.ObjectId | string;
  createdByEmail?: string;
  /**
   * Set for every folder in a trashed subtree, all sharing the timestamp of the
   * folder that was actually trashed — that shared value is how a restore puts
   * back exactly the items this action removed, leaving anything trashed
   * earlier where it is.
   */
  trashedAt?: Date | null;
  /**
   * True only on the folder the user actually trashed, not on the descendants
   * that went with it — so the trash lists what was removed, not every folder
   * underneath it. A separate flag because `trashedFromParentId` is null for a
   * folder that lived at the root, which is a real value, not "unset".
   */
  trashedRoot?: boolean;
  /** Where a restore should put the folder back. Null means the vault root. */
  trashedFromParentId?: Types.ObjectId | null;
  /** Permanently deleted: the row is kept as a tombstone for the audit trail. */
  purgedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Anything except the characters that break a path or a zip entry. Spaces are
 * fine ("Trade Licences"); a name that is only dots is not, since "." and ".."
 * mean traversal in every filesystem and archive format.
 */
export const FOLDER_NAME_RE = /^(?!\.+$)[^/\\:*?"<>|\x00-\x1f]{1,120}$/;

/** Deep enough for any real filing scheme, shallow enough to bound a move. */
export const MAX_FOLDER_DEPTH = 12;

const companyFolderSchema = new Schema<ICompanyFolder>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameLower: { type: String, required: true },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyFolder",
      default: null,
    },
    ancestors: [{ type: Schema.Types.ObjectId, ref: "CompanyFolder" }],
    depth: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByEmail: { type: String },
    trashedAt: { type: Date, default: null },
    trashedRoot: { type: Boolean, default: false },
    trashedFromParentId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyFolder",
      default: null,
    },
    purgedAt: { type: Date, default: null },
  },
  { collection: "company_folders", timestamps: true },
);

// One live folder of a given name per parent. Partial so a trashed or purged
// folder frees its name — the same pattern as the soft-delete-aware slug
// indexes elsewhere in the app.
companyFolderSchema.index(
  { parentId: 1, nameLower: 1 },
  {
    unique: true,
    partialFilterExpression: { trashedAt: null, purgedAt: null },
  },
);
// Subtree reads and bulk subtree writes.
companyFolderSchema.index({ ancestors: 1 });
// Listing a folder's children, and the trash view.
companyFolderSchema.index({ parentId: 1, trashedAt: 1 });
companyFolderSchema.index({ trashedAt: 1 });

export const CompanyFolder: Model<ICompanyFolder> =
  (mongoose.models.CompanyFolder as Model<ICompanyFolder>) ??
  mongoose.model<ICompanyFolder>("CompanyFolder", companyFolderSchema);
