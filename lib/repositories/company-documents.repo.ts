import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  CompanyDocument,
  type ICompanyDocument,
} from "@/lib/models/companyDocument";
import type { Lean } from "@/lib/models/_shared";
import { escapeRegex } from "@/lib/repositories/search-filter";

type DocFilter = NonNullable<
  Parameters<typeof CompanyDocument.countDocuments>[0]
>;

export async function createCompanyDocument(data: Partial<ICompanyDocument>) {
  await connectToDatabase();
  return CompanyDocument.create(data);
}

/**
 * Fetch a document that still has bytes behind it.
 *
 * A purged row is deliberately excluded: it survives only as a tombstone for
 * the audit trail, its encrypted blob is gone and its `fileKey` is cleared, so
 * serving it would fail downstream. Callers treat null as 404.
 *
 * Trashed rows ARE returned, so a document can be previewed before deciding to
 * restore it.
 */
export async function getCompanyDocumentById(
  id: string,
): Promise<Lean<ICompanyDocument> | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return CompanyDocument.findOne({ _id: id, deletedAt: null, purgedAt: null })
    .lean<Lean<ICompanyDocument>>()
    .exec();
}

export async function listCompanyDocuments(params: { folder?: string } = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.folder) q.folder = params.folder;
  return CompanyDocument.find(q as unknown as DocFilter)
    .sort({ createdAt: -1 })
    .limit(500)
    .lean<Lean<ICompanyDocument>[]>()
    .exec();
}

export async function listCompanyDocumentFolders(): Promise<string[]> {
  await connectToDatabase();
  const folders = await CompanyDocument.distinct("folder", {
    deletedAt: null,
    folder: { $nin: [null, ""] },
  }).exec();
  return (folders as (string | null)[])
    .filter((f): f is string => Boolean(f))
    .sort();
}

export async function updateCompanyDocumentMeta(
  id: string,
  patch: { title?: string; folder?: string | null },
): Promise<Lean<ICompanyDocument> | null> {
  await connectToDatabase();
  const set: Record<string, unknown> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (typeof patch.folder === "string") set.folder = patch.folder;
  return CompanyDocument.findOneAndUpdate(
    { _id: id, deletedAt: null },
    patch.folder === null
      ? { $set: set, $unset: { folder: 1 } }
      : { $set: set },
    { returnDocument: "after" },
  )
    .lean<Lean<ICompanyDocument>>()
    .exec();
}

/** Soft-delete (history kept; the encrypted blob stays in storage). */
export async function softDeleteCompanyDocument(
  id: string,
): Promise<Lean<ICompanyDocument> | null> {
  await connectToDatabase();
  return CompanyDocument.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
    { returnDocument: "after" },
  )
    .lean<Lean<ICompanyDocument>>()
    .exec();
}

// ───────────────────────── File-manager queries ─────────────────────────
// Everything below addresses documents through the folder tree (folderId +
// the denormalised `ancestors` chain). The legacy helpers above still serve
// rows written before the tree existed, until the migration has run.

const oid = (id: string) => new mongoose.Types.ObjectId(id);

/** Live = not in the trash and not permanently deleted. */
const LIVE = { trashedAt: null, purgedAt: null } as const;

export type FileSort = "name" | "size" | "type" | "modified";

const SORT_FIELD: Record<FileSort, string> = {
  name: "nameLower",
  size: "size",
  type: "ext",
  modified: "updatedAt",
};

/**
 * Documents in one folder, or anywhere beneath it when `recursive`.
 *
 * `q` matches the display title. It is an unanchored, escaped regex — the same
 * trade-off the catalogue search makes: a collection scan that finds partial
 * words, which is right at vault scale.
 */
export async function listFolderDocuments(params: {
  folderId: string | null;
  q?: string;
  recursive?: boolean;
  trashed?: boolean;
  sort?: FileSort;
  dir?: "asc" | "desc";
}): Promise<Lean<ICompanyDocument>[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = {
    purgedAt: null,
    trashedAt: params.trashed ? { $ne: null } : null,
  };

  if (params.recursive) {
    // Whole subtree; at the root that means every document.
    if (params.folderId) q.ancestors = oid(params.folderId);
  } else {
    q.folderId = params.folderId ? oid(params.folderId) : null;
  }

  if (params.q) {
    q.title = { $regex: escapeRegex(params.q), $options: "i" };
  }

  const field = SORT_FIELD[params.sort ?? "name"];
  const order = params.dir === "desc" ? -1 : 1;

  return CompanyDocument.find(q as unknown as DocFilter)
    .sort({ [field]: order, _id: 1 })
    .limit(1000)
    .lean<Lean<ICompanyDocument>[]>()
    .exec();
}

/** Files the user trashed directly (not ones that went with a folder). */
export async function listTrashedDocumentRoots(): Promise<
  Lean<ICompanyDocument>[]
> {
  await connectToDatabase();
  return CompanyDocument.find({
    purgedAt: null,
    trashedAt: { $ne: null },
    trashedRoot: true,
  })
    .sort({ trashedAt: -1 })
    .lean<Lean<ICompanyDocument>[]>()
    .exec();
}

/** Every live document under a folder — the zip walk and the purge sweep. */
export async function documentsUnderFolder(
  folderId: string,
  opts: { includeTrashed?: boolean } = {},
): Promise<Lean<ICompanyDocument>[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = {
    ancestors: oid(folderId),
    purgedAt: null,
  };
  if (!opts.includeTrashed) q.trashedAt = null;
  return CompanyDocument.find(q as unknown as DocFilter)
    .lean<Lean<ICompanyDocument>[]>()
    .exec();
}

export async function getDocumentsByIds(
  ids: string[],
): Promise<Lean<ICompanyDocument>[]> {
  await connectToDatabase();
  return CompanyDocument.find({
    _id: { $in: ids.filter((id) => mongoose.isValidObjectId(id)).map(oid) },
    purgedAt: null,
  })
    .lean<Lean<ICompanyDocument>[]>()
    .exec();
}

/** Move a document into a folder (its ancestor chain follows the target). */
export async function setDocumentFolder(input: {
  id: string;
  folderId: string | null;
  ancestors: mongoose.Types.ObjectId[];
  modifiedBy?: string;
  modifiedByEmail?: string;
}): Promise<boolean> {
  await connectToDatabase();
  const res = await CompanyDocument.updateOne(
    { _id: input.id, ...LIVE },
    {
      $set: {
        folderId: input.folderId ? oid(input.folderId) : null,
        ancestors: input.ancestors,
        modifiedBy: input.modifiedBy ?? null,
        modifiedByEmail: input.modifiedByEmail ?? null,
      },
    },
  ).exec();
  return res.matchedCount > 0;
}

export async function renameDocument(input: {
  id: string;
  title: string;
  nameLower: string;
  ext?: string;
  modifiedBy?: string;
  modifiedByEmail?: string;
}): Promise<boolean> {
  await connectToDatabase();
  const res = await CompanyDocument.updateOne(
    { _id: input.id, ...LIVE },
    {
      $set: {
        title: input.title,
        nameLower: input.nameLower,
        ...(input.ext !== undefined ? { ext: input.ext } : {}),
        modifiedBy: input.modifiedBy ?? null,
        modifiedByEmail: input.modifiedByEmail ?? null,
      },
    },
  ).exec();
  return res.matchedCount > 0;
}

/** Move documents to the trash, sharing one timestamp (see the folder repo). */
export async function trashDocuments(
  ids: string[],
  at: Date,
  opts: { stampOrigin?: boolean } = {},
): Promise<number> {
  await connectToDatabase();
  const docs = await CompanyDocument.find({
    _id: { $in: ids.map(oid) },
    ...LIVE,
  })
    .select("_id folderId")
    .lean<
      {
        _id: mongoose.Types.ObjectId;
        folderId?: mongoose.Types.ObjectId | null;
      }[]
    >()
    .exec();

  let n = 0;
  for (const d of docs) {
    const res = await CompanyDocument.updateOne(
      { _id: d._id, ...LIVE },
      {
        $set: {
          trashedAt: at,
          // Only a file trashed directly is listed in the trash and remembers
          // where it came from; one that went down with its folder is restored
          // by that folder.
          ...(opts.stampOrigin !== false
            ? { trashedRoot: true, trashedFromFolderId: d.folderId ?? null }
            : {}),
        },
      },
    ).exec();
    n += res.modifiedCount;
  }
  return n;
}

export async function restoreDocument(input: {
  id: string;
  folderId: string | null;
  ancestors: mongoose.Types.ObjectId[];
}): Promise<boolean> {
  await connectToDatabase();
  const res = await CompanyDocument.updateOne(
    { _id: input.id, trashedAt: { $ne: null }, purgedAt: null },
    {
      $set: {
        trashedAt: null,
        trashedRoot: false,
        trashedFromFolderId: null,
        folderId: input.folderId ? oid(input.folderId) : null,
        ancestors: input.ancestors,
      },
    },
  ).exec();
  return res.matchedCount > 0;
}

/**
 * Tombstone a document. Called only after its encrypted blob has actually been
 * removed from storage, so a row that still exists always has its bytes.
 */
export async function purgeDocument(id: string, at: Date): Promise<boolean> {
  await connectToDatabase();
  const res = await CompanyDocument.updateOne(
    { _id: id, purgedAt: null },
    { $set: { purgedAt: at, trashedAt: at, fileKey: "" } },
  ).exec();
  return res.modifiedCount > 0;
}

/** Is a live document with this name already in the folder? */
export async function documentNameTaken(
  folderId: string | null,
  nameLower: string,
  exceptId?: string,
): Promise<boolean> {
  await connectToDatabase();
  const q: Record<string, unknown> = {
    folderId: folderId ? oid(folderId) : null,
    nameLower,
    ...LIVE,
  };
  if (exceptId) q._id = { $ne: oid(exceptId) };
  return (
    (await CompanyDocument.countDocuments(q as unknown as DocFilter).exec()) > 0
  );
}

export async function siblingDocumentNames(
  folderId: string | null,
): Promise<string[]> {
  await connectToDatabase();
  const rows = await CompanyDocument.find(
    { folderId: folderId ? oid(folderId) : null, ...LIVE },
    { nameLower: 1 },
  )
    .lean<{ nameLower: string }[]>()
    .exec();
  return rows.map((r) => r.nameLower);
}

/** Bytes stored, split so the UI can show what the trash is holding on to. */
export async function vaultUsage(): Promise<{
  usedBytes: number;
  trashBytes: number;
  fileCount: number;
}> {
  await connectToDatabase();
  const [agg] = await CompanyDocument.aggregate<{
    usedBytes: number;
    trashBytes: number;
    fileCount: number;
  }>([
    { $match: { purgedAt: null } },
    {
      $group: {
        _id: null,
        usedBytes: { $sum: "$size" },
        trashBytes: {
          $sum: { $cond: [{ $ne: ["$trashedAt", null] }, "$size", 0] },
        },
        fileCount: { $sum: 1 },
      },
    },
  ]);
  return {
    usedBytes: agg?.usedBytes ?? 0,
    trashBytes: agg?.trashBytes ?? 0,
    fileCount: agg?.fileCount ?? 0,
  };
}
