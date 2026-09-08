import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { CompanyFolder, type ICompanyFolder } from "@/lib/models/companyFolder";
import { CompanyDocument } from "@/lib/models/companyDocument";
import type { Lean } from "@/lib/models/_shared";

/**
 * Folder-tree persistence for the company vault.
 *
 * The tree mechanics live here rather than in the service because they are all
 * expressed as Mongo updates over the denormalised `ancestors` chain, and both
 * collections (folders and documents) have to move together.
 */

export type LeanFolder = Lean<ICompanyFolder>;

const oid = (id: string) => new mongoose.Types.ObjectId(id);

/** Live = not in the trash and not permanently deleted. */
const LIVE = { trashedAt: null, purgedAt: null } as const;

export async function getFolderById(id: string): Promise<LeanFolder | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return CompanyFolder.findOne({ _id: id, purgedAt: null })
    .lean<LeanFolder>()
    .exec();
}

export async function listChildFolders(
  parentId: string | null,
  opts: { trashed?: boolean } = {},
): Promise<LeanFolder[]> {
  await connectToDatabase();
  return CompanyFolder.find({
    parentId: parentId ? oid(parentId) : null,
    purgedAt: null,
    trashedAt: opts.trashed ? { $ne: null } : null,
  })
    .sort({ nameLower: 1 })
    .lean<LeanFolder[]>()
    .exec();
}

/** Every live folder, for the sidebar tree. */
export async function listAllFolders(): Promise<LeanFolder[]> {
  await connectToDatabase();
  return CompanyFolder.find(LIVE)
    .sort({ nameLower: 1 })
    .lean<LeanFolder[]>()
    .exec();
}

/**
 * The folders a restore should offer as "explicit" trash roots: the ones the
 * user actually trashed, not the descendants that went with them.
 */
export async function listTrashedFolderRoots(): Promise<LeanFolder[]> {
  await connectToDatabase();
  return CompanyFolder.find({
    purgedAt: null,
    trashedAt: { $ne: null },
    trashedRoot: true,
  })
    .sort({ trashedAt: -1 })
    .lean<LeanFolder[]>()
    .exec();
}

/** Root→folder chain, for the breadcrumb. */
export async function folderPath(folderId: string): Promise<LeanFolder[]> {
  const folder = await getFolderById(folderId);
  if (!folder) return [];
  if (folder.ancestors.length === 0) return [folder];
  const ancestors = await CompanyFolder.find({
    _id: { $in: folder.ancestors },
  })
    .lean<LeanFolder[]>()
    .exec();
  // `ancestors` is stored root-first; restore that order after the $in fetch.
  const byId = new Map(ancestors.map((a) => [String(a._id), a]));
  const chain = folder.ancestors
    .map((a) => byId.get(String(a)))
    .filter((a): a is LeanFolder => Boolean(a));
  return [...chain, folder];
}

export async function createFolder(input: {
  name: string;
  nameLower: string;
  parentId: string | null;
  ancestors: mongoose.Types.ObjectId[];
  createdBy: string;
  createdByEmail?: string;
}) {
  await connectToDatabase();
  return CompanyFolder.create({
    name: input.name,
    nameLower: input.nameLower,
    parentId: input.parentId ? oid(input.parentId) : null,
    ancestors: input.ancestors,
    depth: input.ancestors.length,
    createdBy: input.createdBy,
    createdByEmail: input.createdByEmail,
  });
}

/**
 * Find-or-create one path segment, tolerating a concurrent creator.
 *
 * `$setOnInsert` + upsert is atomic, but two callers can still race on the
 * unique index; the loser gets 11000 and re-reads the winner's row.
 */
export async function ensureFolder(input: {
  name: string;
  nameLower: string;
  parentId: string | null;
  ancestors: mongoose.Types.ObjectId[];
  createdBy: string;
  createdByEmail?: string;
}): Promise<LeanFolder> {
  await connectToDatabase();
  const filter = {
    parentId: input.parentId ? oid(input.parentId) : null,
    nameLower: input.nameLower,
    ...LIVE,
  };
  try {
    const doc = await CompanyFolder.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          name: input.name,
          nameLower: input.nameLower,
          parentId: input.parentId ? oid(input.parentId) : null,
          ancestors: input.ancestors,
          depth: input.ancestors.length,
          createdBy: input.createdBy,
          createdByEmail: input.createdByEmail,
        },
      },
      { upsert: true, returnDocument: "after" },
    )
      .lean<LeanFolder>()
      .exec();
    return doc!;
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
    const existing = await CompanyFolder.findOne(filter)
      .lean<LeanFolder>()
      .exec();
    if (!existing) throw e;
    return existing;
  }
}

export async function renameFolder(
  id: string,
  name: string,
  nameLower: string,
) {
  await connectToDatabase();
  const res = await CompanyFolder.updateOne(
    { _id: id, ...LIVE },
    { $set: { name, nameLower } },
  ).exec();
  return res.matchedCount > 0;
}

/**
 * Re-parent a folder and rewrite the ancestor chain of everything beneath it.
 *
 * The subtree rewrite is a single pipeline update per collection: keep the part
 * of each descendant's chain that is BELOW the moved folder (everything after
 * the moved folder's own id) and splice the new prefix on. Depth follows from
 * the new chain length.
 */
export async function moveFolderSubtree(input: {
  folderId: string;
  newParentId: string | null;
  newAncestors: mongoose.Types.ObjectId[];
  /** Set when the destination already holds this name — applied in the same
   *  write, or the unique index rejects the move before the rename lands. */
  rename?: { name: string; nameLower: string };
}): Promise<void> {
  await connectToDatabase();
  const id = oid(input.folderId);

  await CompanyFolder.updateOne(
    { _id: id },
    {
      $set: {
        parentId: input.newParentId ? oid(input.newParentId) : null,
        ancestors: input.newAncestors,
        depth: input.newAncestors.length,
        ...(input.rename
          ? { name: input.rename.name, nameLower: input.rename.nameLower }
          : {}),
      },
    },
  ).exec();

  const rewrite = [
    {
      $set: {
        ancestors: {
          $concatArrays: [
            input.newAncestors,
            [id],
            {
              $slice: [
                "$ancestors",
                { $add: [{ $indexOfArray: ["$ancestors", id] }, 1] },
                { $size: "$ancestors" },
              ],
            },
          ],
        },
      },
    },
    { $set: { depth: { $size: "$ancestors" } } },
  ];

  // `updatePipeline: true` is required in Mongoose 9 to pass an aggregation
  // pipeline to an update; without it the array is rejected outright.
  await CompanyFolder.updateMany({ ancestors: id }, rewrite, {
    updatePipeline: true,
  }).exec();
  // Documents carry the same chain but have no depth field.
  await CompanyDocument.updateMany({ ancestors: id }, [rewrite[0]!], {
    updatePipeline: true,
  }).exec();
}

/**
 * Trash a folder and everything under it, stamping one shared timestamp so a
 * later restore can put back exactly this set.
 */
export async function trashFolderSubtree(
  id: string,
  at: Date,
): Promise<{ folders: number; files: number }> {
  await connectToDatabase();
  const _id = oid(id);
  const folders = await CompanyFolder.updateMany(
    { $or: [{ _id }, { ancestors: _id }], trashedAt: null, purgedAt: null },
    { $set: { trashedAt: at } },
  ).exec();
  const files = await CompanyDocument.updateMany(
    { ancestors: _id, trashedAt: null, purgedAt: null },
    { $set: { trashedAt: at } },
  ).exec();
  return {
    folders: folders.modifiedCount,
    files: files.modifiedCount,
  };
}

/**
 * Restore the set trashed in one action: every descendant carrying the same
 * timestamp. Anything trashed separately (earlier or later) keeps its own
 * timestamp and stays in the trash.
 */
export async function restoreFolderSubtree(
  id: string,
  trashedAt: Date,
  restoreTo: { parentId: string | null; ancestors: mongoose.Types.ObjectId[] },
  rename?: { name: string; nameLower: string },
): Promise<void> {
  await connectToDatabase();
  const _id = oid(id);

  await CompanyFolder.updateMany(
    { $or: [{ _id }, { ancestors: _id }], trashedAt },
    {
      $set: {
        trashedAt: null,
        trashedRoot: false,
        trashedFromParentId: null,
      },
    },
  ).exec();
  await CompanyDocument.updateMany(
    { ancestors: _id, trashedAt },
    {
      $set: { trashedAt: null, trashedRoot: false, trashedFromFolderId: null },
    },
  ).exec();

  // The folder may be going back somewhere new (its old parent could be gone),
  // so re-seat it and rewrite the subtree's chains.
  await moveFolderSubtree({
    folderId: id,
    newParentId: restoreTo.parentId,
    newAncestors: restoreTo.ancestors,
    rename,
  });
}

/**
 * Record where a folder was trashed from, so a restore can put it back. Only
 * the folder the user actually trashed carries this; its descendants are
 * restored by their parent.
 */
export async function markFolderTrashOrigin(
  id: string,
  parentId: string | null,
  at: Date,
): Promise<void> {
  await connectToDatabase();
  await CompanyFolder.updateOne(
    { _id: id },
    {
      $set: {
        trashedAt: at,
        trashedRoot: true,
        trashedFromParentId: parentId ? oid(parentId) : null,
      },
    },
  ).exec();
}

/** Every folder in the subtree, including the root itself. */
export async function folderSubtree(id: string): Promise<LeanFolder[]> {
  await connectToDatabase();
  const _id = oid(id);
  return CompanyFolder.find({
    $or: [{ _id }, { ancestors: _id }],
    purgedAt: null,
  })
    .lean<LeanFolder[]>()
    .exec();
}

/** Tombstone folders after their documents' blobs have been deleted. */
export async function purgeFolders(ids: string[], at: Date): Promise<number> {
  await connectToDatabase();
  const res = await CompanyFolder.updateMany(
    { _id: { $in: ids.map(oid) }, purgedAt: null },
    { $set: { purgedAt: at, trashedAt: at } },
  ).exec();
  return res.modifiedCount;
}

/** Is `name` already taken by a live sibling? */
export async function folderNameTaken(
  parentId: string | null,
  nameLower: string,
  exceptId?: string,
): Promise<boolean> {
  await connectToDatabase();
  const q: Record<string, unknown> = {
    parentId: parentId ? oid(parentId) : null,
    nameLower,
    ...LIVE,
  };
  if (exceptId) q._id = { $ne: oid(exceptId) };
  return (await CompanyFolder.countDocuments(q).exec()) > 0;
}

/** Live sibling names in a folder — used to derive a free "name (2)". */
export async function siblingFolderNames(
  parentId: string | null,
): Promise<string[]> {
  await connectToDatabase();
  const rows = await CompanyFolder.find(
    { parentId: parentId ? oid(parentId) : null, ...LIVE },
    { nameLower: 1 },
  )
    .lean<{ nameLower: string }[]>()
    .exec();
  return rows.map((r) => r.nameLower);
}
