import mongoose from "mongoose";
import { getStorage } from "@/lib/storage";
import {
  encryptVaultBlob,
  decryptVaultBlob,
  getVaultKey,
} from "@/lib/crypto/vault";
import { getSetting } from "@/lib/repositories/settings.repo";
import { mimeMatchesBytes, extensionMatches } from "@/lib/uploads/sniff";
import { logger } from "@/lib/log";
import {
  MAX_FOLDER_DEPTH,
  type ICompanyFolder,
} from "@/lib/models/companyFolder";
import {
  CompanyDocument,
  type ICompanyDocument,
} from "@/lib/models/companyDocument";
import type { Lean } from "@/lib/models/_shared";
import {
  getFolderById,
  listChildFolders,
  listAllFolders,
  listTrashedFolderRoots,
  folderPath,
  createFolder,
  ensureFolder,
  renameFolder,
  moveFolderSubtree,
  trashFolderSubtree,
  restoreFolderSubtree,
  folderSubtree,
  purgeFolders,
  siblingFolderNames,
  markFolderTrashOrigin,
  type LeanFolder,
} from "@/lib/repositories/company-folders.repo";
import {
  createCompanyDocument,
  getCompanyDocumentById,
  listFolderDocuments,
  listTrashedDocumentRoots,
  documentsUnderFolder,
  getDocumentsByIds,
  setDocumentFolder,
  renameDocument,
  trashDocuments,
  restoreDocument,
  purgeDocument,
  siblingDocumentNames,
  vaultUsage,
  type FileSort,
} from "@/lib/repositories/company-documents.repo";
import { randomBytes } from "node:crypto";

/**
 * The company file manager.
 *
 * Rules that need more than one write, or a decision, live here; the raw tree
 * updates live in the two repositories. Nothing in this file assumes a
 * transaction — the app runs on standalone Mongo — so each operation is either
 * a single atomic update or an ordered sequence whose failure mode is stated
 * where it happens.
 */

// The file types the vault accepts. Anything else is refused before it is
// stored, and the bytes are checked against the claim (see lib/uploads/sniff).
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/csv",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GiB
/** A folder copy or zip that walks more files than this is refused. */
const MAX_SUBTREE_FILES = 500;

export type Actor = { sub: string; email: string };

export type FsError =
  | "not_found"
  | "name_taken"
  | "cycle"
  | "too_deep"
  | "quota_exceeded"
  | "too_large"
  | "bad_type"
  | "vault_not_configured"
  | "too_many_files"
  | "not_trashed";

export type FsResult<T> = { ok: true; data: T } | { ok: false; code: FsError };

const fail = (code: FsError): FsResult<never> => ({ ok: false, code });
const done = <T>(data: T): FsResult<T> => ({ ok: true, data });

const oid = (id: string) => new mongoose.Types.ObjectId(id);

// ───────────────────────────── naming ─────────────────────────────

/** Split "report.pdf" into its display stem and extension. */
function splitName(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return { stem: name, ext: "" };
  return { stem: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() };
}

/**
 * A name that is free among `taken` (all lowercased), by appending " (2)",
 * " (3)"… before the extension — what a desktop file manager does when you
 * copy a file into a folder that already has one by that name.
 */
export function uniqueName(desired: string, taken: Iterable<string>): string {
  const set = new Set(Array.from(taken, (t) => t.toLowerCase()));
  if (!set.has(desired.toLowerCase())) return desired;
  const { stem, ext } = splitName(desired);
  const suffix = ext ? `.${ext}` : "";
  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem} (${n})${suffix}`;
    if (!set.has(candidate.toLowerCase())) return candidate;
  }
  // Practically unreachable; keeps the function total rather than looping.
  return `${stem} (${Date.now()})${suffix}`;
}

// ───────────────────────────── reading ─────────────────────────────

export type FolderNode = {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  /** Rolled up from everything beneath it, so the row is never three dashes. */
  itemCount?: number;
  sizeBytes?: number;
  modifiedAt?: string | null;
  createdByEmail?: string | null;
};

export type FileNode = {
  id: string;
  title: string;
  filename: string;
  contentType: string;
  ext: string | null;
  size: number;
  folderId: string | null;
  uploadedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  trashedAt: string | null;
};

const toFolderNode = (f: LeanFolder): FolderNode => ({
  id: String(f._id),
  name: f.name,
  parentId: f.parentId ? String(f.parentId) : null,
  depth: f.depth,
  modifiedAt: f.updatedAt ? new Date(f.updatedAt).toISOString() : null,
  createdByEmail: f.createdByEmail ?? null,
});

/**
 * How much is inside each of these folders, at any depth.
 *
 * One aggregation over the denormalised `ancestors` chain rather than a walk
 * per folder — the same index that makes subtree moves cheap. Without this the
 * listing showed a folder's Size, Modified and Uploaded-by columns as dashes,
 * which read like the table was broken.
 */
async function folderRollups(
  ids: string[],
): Promise<Map<string, { itemCount: number; sizeBytes: number }>> {
  const out = new Map<string, { itemCount: number; sizeBytes: number }>();
  if (ids.length === 0) return out;
  const rows = await CompanyDocument.aggregate<{
    _id: unknown;
    itemCount: number;
    sizeBytes: number;
  }>([
    {
      $match: {
        ancestors: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
        trashedAt: null,
        purgedAt: null,
      },
    },
    { $unwind: "$ancestors" },
    {
      $group: {
        _id: "$ancestors",
        itemCount: { $sum: 1 },
        sizeBytes: { $sum: { $ifNull: ["$size", 0] } },
      },
    },
  ]).exec();
  for (const r of rows) {
    out.set(String(r._id), {
      itemCount: r.itemCount,
      sizeBytes: r.sizeBytes,
    });
  }
  return out;
}

const toFileNode = (d: Lean<ICompanyDocument>): FileNode => ({
  id: String(d._id),
  title: d.title,
  filename: d.originalFilename,
  contentType: d.contentType,
  ext: d.ext ?? null,
  size: d.size,
  folderId: d.folderId ? String(d.folderId) : null,
  uploadedByEmail: d.uploadedByEmail ?? null,
  createdAt: (d.createdAt as Date).toISOString(),
  updatedAt: (d.updatedAt as Date).toISOString(),
  trashedAt: d.trashedAt ? (d.trashedAt as Date).toISOString() : null,
});

export type ListResult = {
  folder: FolderNode | null;
  breadcrumb: FolderNode[];
  folders: FolderNode[];
  files: FileNode[];
  usage: {
    usedBytes: number;
    trashBytes: number;
    fileCount: number;
    quotaBytes: number;
  };
};

/**
 * One folder's contents (or the trash, or a recursive search).
 *
 * Folders always sort by name: a folder has no meaningful size or type, and
 * mixing them into a size sort just scatters them through the list.
 */
export async function listChildren(params: {
  folderId: string | null;
  sort?: FileSort;
  dir?: "asc" | "desc";
  q?: string;
  recursive?: boolean;
  trash?: boolean;
}): Promise<FsResult<ListResult>> {
  const folder = params.folderId ? await getFolderById(params.folderId) : null;
  if (params.folderId && (!folder || folder.purgedAt)) return fail("not_found");

  const [folders, files, usage, quotaBytes] = await Promise.all([
    params.trash
      ? listTrashedFolderRoots()
      : listChildFolders(params.folderId, { trashed: false }),
    params.trash
      ? listTrashedDocumentRoots()
      : listFolderDocuments({
          folderId: params.folderId,
          q: params.q,
          recursive: params.recursive,
          sort: params.sort,
          dir: params.dir,
        }),
    vaultUsage(),
    quota(),
  ]);

  // A folder search filters the folder list by name too.
  const needle = params.q?.toLowerCase();
  const visibleFolders = needle
    ? folders.filter((f) => f.nameLower.includes(needle))
    : folders;

  const nodes = visibleFolders.map(toFolderNode);
  const rollups = await folderRollups(nodes.map((n) => n.id));

  return done({
    folder: folder ? toFolderNode(folder) : null,
    breadcrumb: params.folderId
      ? (await folderPath(params.folderId)).map(toFolderNode)
      : [],
    folders: nodes.map((n) => ({
      ...n,
      itemCount: rollups.get(n.id)?.itemCount ?? 0,
      sizeBytes: rollups.get(n.id)?.sizeBytes ?? 0,
    })),
    files: files.map(toFileNode),
    usage: { ...usage, quotaBytes },
  });
}

/** The whole live tree, for the sidebar. */
export async function getTree(): Promise<FolderNode[]> {
  return (await listAllFolders()).map(toFolderNode);
}

async function quota(): Promise<number> {
  const v = await getSetting<number>("company.vault.quotaBytes").catch(
    () => null,
  );
  return typeof v === "number" && v > 0 ? v : DEFAULT_QUOTA_BYTES;
}

// ───────────────────────────── folders ─────────────────────────────

/**
 * The ancestor chain that anything placed directly inside `parentId` should
 * carry — the parent's own chain plus the parent itself. It is the same for a
 * child folder and for a document, so callers must not append the parent again.
 */
async function chainFor(
  parentId: string | null,
): Promise<
  | { ok: true; ancestors: mongoose.Types.ObjectId[] }
  | { ok: false; code: FsError }
> {
  if (!parentId) return { ok: true, ancestors: [] };
  const parent = await getFolderById(parentId);
  if (!parent || parent.trashedAt || parent.purgedAt) {
    return { ok: false, code: "not_found" };
  }
  if (parent.depth + 1 >= MAX_FOLDER_DEPTH)
    return { ok: false, code: "too_deep" };
  return {
    ok: true,
    ancestors: [...parent.ancestors.map((a) => oid(String(a))), oid(parentId)],
  };
}

export async function createFolderIn(
  input: { name: string; parentId: string | null },
  actor: Actor,
): Promise<FsResult<FolderNode>> {
  const chain = await chainFor(input.parentId);
  if (!chain.ok) return fail(chain.code);

  const taken = await siblingFolderNames(input.parentId);
  if (taken.includes(input.name.toLowerCase())) return fail("name_taken");

  try {
    const doc = await createFolder({
      name: input.name,
      nameLower: input.name.toLowerCase(),
      parentId: input.parentId,
      ancestors: chain.ancestors,
      createdBy: actor.sub,
      createdByEmail: actor.email,
    });
    return done(toFolderNode(doc.toObject() as LeanFolder));
  } catch (e) {
    // Lost a race against another creator on the unique index.
    if ((e as { code?: number }).code === 11000) return fail("name_taken");
    throw e;
  }
}

/**
 * Create every segment of a path, reusing what exists. Used by the app itself
 * to file generated documents (e.g. Sales / <organisation> / Invoices).
 */
export async function ensureFolderPath(
  names: string[],
  actor: Actor,
): Promise<FsResult<FolderNode>> {
  let parentId: string | null = null;
  let ancestors: mongoose.Types.ObjectId[] = [];
  let current: LeanFolder | null = null;

  for (const raw of names) {
    const name = raw.trim().slice(0, 120);
    if (!name) continue;
    if (ancestors.length >= MAX_FOLDER_DEPTH) return fail("too_deep");
    current = await ensureFolder({
      name,
      nameLower: name.toLowerCase(),
      parentId,
      ancestors,
      createdBy: actor.sub,
      createdByEmail: actor.email,
    });
    parentId = String(current._id);
    ancestors = [...ancestors, oid(parentId)];
  }

  if (!current) return fail("not_found");
  return done(toFolderNode(current));
}

export async function renameFolderById(
  id: string,
  name: string,
): Promise<FsResult<FolderNode>> {
  const folder = await getFolderById(id);
  if (!folder || folder.trashedAt || folder.purgedAt) return fail("not_found");

  const parentId = folder.parentId ? String(folder.parentId) : null;
  const taken = (await siblingFolderNames(parentId)).filter(
    (n) => n !== folder.nameLower,
  );
  if (taken.includes(name.toLowerCase())) return fail("name_taken");

  const okRename = await renameFolder(id, name, name.toLowerCase());
  if (!okRename) return fail("not_found");
  return done({ ...toFolderNode(folder), name });
}

/**
 * Move a folder. Refuses to put a folder inside itself or one of its own
 * descendants — that would detach the subtree from the tree entirely, and the
 * `ancestors` chain makes the check a single array lookup.
 */
export async function moveFolder(
  id: string,
  targetId: string | null,
): Promise<FsResult<FolderNode>> {
  const folder = await getFolderById(id);
  if (!folder || folder.trashedAt || folder.purgedAt) return fail("not_found");
  if (targetId === id) return fail("cycle");

  if (targetId) {
    const target = await getFolderById(targetId);
    if (!target || target.trashedAt || target.purgedAt)
      return fail("not_found");
    if (target.ancestors.some((a) => String(a) === id)) return fail("cycle");
  }

  const chain = await chainFor(targetId);
  if (!chain.ok) return fail(chain.code);

  // Deepest descendant must still fit under the new parent.
  const subtree = await folderSubtree(id);
  const maxRelative = Math.max(...subtree.map((f) => f.depth - folder.depth));
  if (chain.ancestors.length + maxRelative >= MAX_FOLDER_DEPTH) {
    return fail("too_deep");
  }

  const taken = await siblingFolderNames(targetId);
  const name = uniqueName(folder.name, taken);

  await moveFolderSubtree({
    folderId: id,
    newParentId: targetId,
    newAncestors: chain.ancestors,
    ...(name !== folder.name
      ? { rename: { name, nameLower: name.toLowerCase() } }
      : {}),
  });

  return done({
    id,
    name,
    parentId: targetId,
    depth: chain.ancestors.length,
  });
}

// ───────────────────────────── documents ─────────────────────────────

export async function renameDocumentById(
  id: string,
  title: string,
): Promise<FsResult<{ id: string; title: string }>> {
  const doc = await getCompanyDocumentById(id);
  if (!doc || doc.trashedAt || doc.purgedAt) return fail("not_found");

  const folderId = doc.folderId ? String(doc.folderId) : null;
  const taken = (await siblingDocumentNames(folderId)).filter(
    (n) => n !== (doc.nameLower || doc.title.toLowerCase()),
  );
  if (taken.includes(title.toLowerCase())) return fail("name_taken");

  const okRename = await renameDocument({
    id,
    title,
    nameLower: title.toLowerCase(),
    ext: splitName(title).ext || undefined,
  });
  if (!okRename) return fail("not_found");
  return done({ id, title });
}

export async function moveDocument(
  id: string,
  targetId: string | null,
  actor: Actor,
): Promise<FsResult<{ id: string; title: string }>> {
  const doc = await getCompanyDocumentById(id);
  if (!doc || doc.trashedAt || doc.purgedAt) return fail("not_found");

  const chain = await chainFor(targetId);
  if (!chain.ok) return fail(chain.code);

  const taken = await siblingDocumentNames(targetId);
  const title = uniqueName(doc.title, taken);

  const moved = await setDocumentFolder({
    id,
    folderId: targetId,
    ancestors: chain.ancestors,
    modifiedBy: actor.sub,
    modifiedByEmail: actor.email,
  });
  if (!moved) return fail("not_found");

  if (title !== doc.title) {
    await renameDocument({
      id,
      title,
      nameLower: title.toLowerCase(),
      ext: doc.ext,
    });
  }
  return done({ id, title });
}

// ───────────────────────────── upload ─────────────────────────────

export type UploadOutcome =
  | { ok: true; id: string; title: string }
  | { ok: false; filename: string; code: FsError };

/**
 * Store one file: validate, encrypt, write to private storage, then record it.
 *
 * The blob is written before the row, so a crash in between leaves an orphaned
 * blob (invisible, reclaimable) rather than a row pointing at nothing — the
 * safer direction when the row is what grants access.
 */
export async function uploadDocument(
  input: {
    filename: string;
    contentType: string;
    body: Buffer;
    folderId: string | null;
    source?: { kind: string; id: string } | null;
  },
  actor: Actor,
): Promise<UploadOutcome> {
  const bad = (code: FsError): UploadOutcome => ({
    ok: false,
    filename: input.filename,
    code,
  });

  const key = getVaultKey();
  if (!key) return bad("vault_not_configured");
  if (input.body.length > MAX_UPLOAD_BYTES) return bad("too_large");
  if (!ALLOWED_MIME.has(input.contentType)) return bad("bad_type");
  if (!mimeMatchesBytes(input.contentType, input.body)) return bad("bad_type");
  if (!extensionMatches(input.contentType, input.filename))
    return bad("bad_type");

  if (input.folderId) {
    const parent = await getFolderById(input.folderId);
    if (!parent || parent.trashedAt || parent.purgedAt) return bad("not_found");
  }

  const [usage, quotaBytes] = await Promise.all([vaultUsage(), quota()]);
  if (usage.usedBytes + input.body.length > quotaBytes)
    return bad("quota_exceeded");

  const title = uniqueName(
    input.filename.slice(0, 200),
    await siblingDocumentNames(input.folderId),
  );

  const chain = await chainFor(input.folderId);
  if (!chain.ok) return bad(chain.code);
  const ancestors = chain.ancestors;

  const storageKey = `company-vault/${randomBytes(16).toString("hex")}.bin`;
  await getStorage().put({
    key: storageKey,
    body: encryptVaultBlob(input.body, key),
    contentType: "application/octet-stream",
    private: true,
  });

  const doc = await createCompanyDocument({
    title,
    originalFilename: input.filename.slice(0, 200),
    fileKey: storageKey,
    contentType: input.contentType,
    size: input.body.length,
    folderId: input.folderId ? oid(input.folderId) : null,
    ancestors,
    nameLower: title.toLowerCase(),
    ext: splitName(input.filename).ext || undefined,
    uploadedBy: actor.sub,
    uploadedByEmail: actor.email,
    encrypted: true,
    source: input.source ?? null,
  });

  return { ok: true, id: String(doc._id), title };
}

// ───────────────────────────── copy ─────────────────────────────

/** Copy one file: a fresh encryption of the same plaintext, never a shared blob. */
async function copyOneDocument(
  doc: Lean<ICompanyDocument>,
  targetFolderId: string | null,
  actor: Actor,
): Promise<FsResult<{ id: string }>> {
  const key = getVaultKey();
  if (!key) return fail("vault_not_configured");

  const obj = await getStorage().getObject({ key: doc.fileKey });
  if (!obj) return fail("not_found");
  const chunks: Uint8Array[] = [];
  const reader = obj.body.getReader();
  for (;;) {
    const { done: fin, value } = await reader.read();
    if (fin) break;
    if (value) chunks.push(value);
  }
  const plain = decryptVaultBlob(Buffer.concat(chunks), key);

  // uploadDocument names the copy by its filename and already resolves any
  // clash in the destination, so there is nothing to rename afterwards.
  const out = await uploadDocument(
    {
      filename: doc.originalFilename,
      contentType: doc.contentType,
      body: plain,
      folderId: targetFolderId,
      source: doc.source ?? null,
    },
    actor,
  );
  if (!out.ok) return fail(out.code);
  return done({ id: out.id });
}

export async function copyDocument(
  id: string,
  targetId: string | null,
  actor: Actor,
): Promise<FsResult<{ id: string }>> {
  const doc = await getCompanyDocumentById(id);
  if (!doc || doc.trashedAt || doc.purgedAt) return fail("not_found");
  return copyOneDocument(doc, targetId, actor);
}

/** Copy a folder and everything under it, preserving the shape. */
export async function copyFolder(
  id: string,
  targetId: string | null,
  actor: Actor,
): Promise<FsResult<{ id: string }>> {
  const folder = await getFolderById(id);
  if (!folder || folder.trashedAt || folder.purgedAt) return fail("not_found");
  if (targetId === id) return fail("cycle");
  if (targetId) {
    const target = await getFolderById(targetId);
    if (!target || target.trashedAt || target.purgedAt)
      return fail("not_found");
    if (target.ancestors.some((a) => String(a) === id)) return fail("cycle");
  }

  const files = await documentsUnderFolder(id);
  if (files.length > MAX_SUBTREE_FILES) return fail("too_many_files");

  const subtree = await folderSubtree(id);
  const name = uniqueName(folder.name, await siblingFolderNames(targetId));
  const rootCopy = await createFolderIn({ name, parentId: targetId }, actor);
  if (!rootCopy.ok) return rootCopy;

  // Map every original folder id to its copy, parents before children.
  const idMap = new Map<string, string>([[id, rootCopy.data.id]]);
  for (const f of subtree
    .filter((f) => String(f._id) !== id)
    .sort((a, b) => a.depth - b.depth)) {
    const parent = f.parentId ? idMap.get(String(f.parentId)) : null;
    if (parent === undefined) continue; // parent was skipped; skip the child
    const made = await createFolderIn(
      { name: f.name, parentId: parent },
      actor,
    );
    if (made.ok) idMap.set(String(f._id), made.data.id);
  }

  for (const doc of files) {
    const target = doc.folderId ? idMap.get(String(doc.folderId)) : null;
    if (target === undefined) continue;
    await copyOneDocument(doc, target, actor);
  }
  return done({ id: rootCopy.data.id });
}

// ───────────────────────────── trash ─────────────────────────────

export type BulkOutcome = {
  folders: number;
  files: number;
  failed: { id: string; code: FsError }[];
};

export async function trashItems(input: {
  folderIds: string[];
  fileIds: string[];
}): Promise<BulkOutcome> {
  // One timestamp for the whole action: restoring later puts back exactly this
  // set, and anything already in the trash keeps its own timestamp.
  const at = new Date();
  const out: BulkOutcome = { folders: 0, files: 0, failed: [] };

  for (const id of input.folderIds) {
    const folder = await getFolderById(id);
    if (!folder || folder.trashedAt || folder.purgedAt) {
      out.failed.push({ id, code: "not_found" });
      continue;
    }
    const res = await trashFolderSubtree(id, at);
    // Remember where the folder itself came from, for a restore.
    await markFolderTrashOrigin(
      id,
      folder.parentId ? String(folder.parentId) : null,
      at,
    );
    out.folders += res.folders;
    out.files += res.files;
  }

  if (input.fileIds.length > 0) {
    out.files += await trashDocuments(input.fileIds, at);
  }
  return out;
}

/**
 * Put trashed items back. If the folder they came from is gone (or is itself
 * still in the trash) they go to the root rather than failing — the point of a
 * restore is to get the file back, not to insist the old shelf still exists.
 */
export async function restoreItems(input: {
  folderIds: string[];
  fileIds: string[];
}): Promise<BulkOutcome> {
  const out: BulkOutcome = { folders: 0, files: 0, failed: [] };

  for (const id of input.folderIds) {
    const folder = await getFolderById(id);
    if (!folder || !folder.trashedAt || folder.purgedAt) {
      out.failed.push({ id, code: "not_trashed" });
      continue;
    }
    const home = await liveParentOrRoot(
      folder.trashedFromParentId ? String(folder.trashedFromParentId) : null,
    );
    const name = uniqueName(
      folder.name,
      await siblingFolderNames(home.parentId),
    );
    await restoreFolderSubtree(
      id,
      folder.trashedAt as Date,
      home,
      name !== folder.name
        ? { name, nameLower: name.toLowerCase() }
        : undefined,
    );
    out.folders += 1;
  }

  for (const id of input.fileIds) {
    const doc = await getCompanyDocumentById2(id);
    if (!doc || !doc.trashedAt || doc.purgedAt) {
      out.failed.push({ id, code: "not_trashed" });
      continue;
    }
    const home = await liveParentOrRoot(
      doc.trashedFromFolderId ? String(doc.trashedFromFolderId) : null,
    );
    const title = uniqueName(
      doc.title,
      await siblingDocumentNames(home.parentId),
    );
    await restoreDocument({
      id,
      folderId: home.parentId,
      // `home.ancestors` is the destination folder's OWN chain, so the folder
      // itself still has to be appended here.
      ancestors: home.parentId ? [...home.ancestors, oid(home.parentId)] : [],
    });
    if (title !== doc.title) {
      await renameDocument({
        id,
        title,
        nameLower: title.toLowerCase(),
        ext: doc.ext,
      });
    }
    out.files += 1;
  }
  return out;
}

/** Where a restore should land: the original folder, or the root if it is gone. */
async function liveParentOrRoot(
  parentId: string | null,
): Promise<{ parentId: string | null; ancestors: mongoose.Types.ObjectId[] }> {
  if (!parentId) return { parentId: null, ancestors: [] };
  const parent = await getFolderById(parentId);
  if (!parent || parent.trashedAt || parent.purgedAt) {
    return { parentId: null, ancestors: [] };
  }
  return {
    parentId,
    ancestors: parent.ancestors.map((a) => oid(String(a))),
  };
}

/** Trashed documents are invisible to getCompanyDocumentById (deletedAt-based). */
async function getCompanyDocumentById2(
  id: string,
): Promise<Lean<ICompanyDocument> | null> {
  const [doc] = await getDocumentsByIds([id]);
  return doc ?? null;
}

/**
 * Permanent delete. The encrypted blob goes first: only once the bytes are
 * actually gone is the row tombstoned, so a row that still exists always has a
 * file behind it. A blob that refuses to delete leaves the row in the trash and
 * is reported rather than silently forgotten.
 */
export async function purgeItems(input: {
  folderIds: string[];
  fileIds: string[];
}): Promise<BulkOutcome> {
  const at = new Date();
  const out: BulkOutcome = { folders: 0, files: 0, failed: [] };
  const storage = getStorage();

  const purgeDoc = async (doc: Lean<ICompanyDocument>) => {
    try {
      if (doc.fileKey) {
        await storage.delete({ key: doc.fileKey, private: true });
      }
      if (await purgeDocument(String(doc._id), at)) out.files += 1;
    } catch (e) {
      logger.warn("vault: could not delete blob; keeping the record", e);
      out.failed.push({ id: String(doc._id), code: "not_found" });
    }
  };

  for (const id of input.folderIds) {
    const folder = await getFolderById(id);
    if (!folder || folder.purgedAt) {
      out.failed.push({ id, code: "not_found" });
      continue;
    }
    const files = await documentsUnderFolder(id, { includeTrashed: true });
    for (const doc of files) await purgeDoc(doc);
    const subtree = await folderSubtree(id);
    out.folders += await purgeFolders(
      subtree.map((f) => String(f._id)),
      at,
    );
  }

  for (const doc of await getDocumentsByIds(input.fileIds)) {
    await purgeDoc(doc);
  }
  return out;
}

// ───────────────────────────── move/copy in bulk ─────────────────────────────

export async function moveItems(
  input: { folderIds: string[]; fileIds: string[]; targetId: string | null },
  actor: Actor,
): Promise<BulkOutcome> {
  const out: BulkOutcome = { folders: 0, files: 0, failed: [] };
  for (const id of input.folderIds) {
    const res = await moveFolder(id, input.targetId);
    if (res.ok) out.folders += 1;
    else out.failed.push({ id, code: res.code });
  }
  for (const id of input.fileIds) {
    const res = await moveDocument(id, input.targetId, actor);
    if (res.ok) out.files += 1;
    else out.failed.push({ id, code: res.code });
  }
  return out;
}

export async function copyItems(
  input: { folderIds: string[]; fileIds: string[]; targetId: string | null },
  actor: Actor,
): Promise<BulkOutcome> {
  const out: BulkOutcome = { folders: 0, files: 0, failed: [] };
  for (const id of input.folderIds) {
    const res = await copyFolder(id, input.targetId, actor);
    if (res.ok) out.folders += 1;
    else out.failed.push({ id, code: res.code });
  }
  for (const id of input.fileIds) {
    const res = await copyDocument(id, input.targetId, actor);
    if (res.ok) out.files += 1;
    else out.failed.push({ id, code: res.code });
  }
  return out;
}

// ───────────────────────────── zip ─────────────────────────────

export type ZipEntry = { path: string; doc: Lean<ICompanyDocument> };

/**
 * The files a download should contain, with the relative path each takes inside
 * the archive. Resolved up front so the route can refuse an oversized request
 * before it starts streaming.
 */
export async function zipManifest(input: {
  folderIds: string[];
  fileIds: string[];
}): Promise<FsResult<ZipEntry[]>> {
  const entries: ZipEntry[] = [];
  const used = new Set<string>();

  const add = (path: string, doc: Lean<ICompanyDocument>) => {
    const unique = uniqueName(path, used);
    used.add(unique.toLowerCase());
    entries.push({ path: unique, doc });
  };

  for (const id of input.folderIds) {
    const folder = await getFolderById(id);
    if (!folder || folder.purgedAt) continue;
    const subtree = await folderSubtree(id);
    const nameById = new Map(subtree.map((f) => [String(f._id), f.name]));
    const base = folder.name;

    for (const doc of await documentsUnderFolder(id)) {
      // Path relative to the folder being downloaded.
      const chain = doc.ancestors.map((a) => String(a));
      const from = chain.indexOf(id);
      const segments = chain
        .slice(from + 1)
        .map((fid) => nameById.get(fid))
        .filter((n): n is string => Boolean(n));
      add([base, ...segments, doc.title].join("/"), doc);
    }
  }

  for (const doc of await getDocumentsByIds(input.fileIds)) {
    if (doc.trashedAt || doc.purgedAt) continue;
    add(doc.title, doc);
  }

  if (entries.length === 0) return fail("not_found");
  if (entries.length > MAX_SUBTREE_FILES) return fail("too_many_files");
  return done(entries);
}

/** Decrypt one stored document into memory (the zip walk does this per file). */
export async function readDocumentBytes(
  doc: Lean<ICompanyDocument>,
): Promise<Buffer | null> {
  const key = getVaultKey();
  if (!key) return null;
  const obj = await getStorage().getObject({ key: doc.fileKey });
  if (!obj) return null;
  const chunks: Uint8Array[] = [];
  const reader = obj.body.getReader();
  for (;;) {
    const { done: fin, value } = await reader.read();
    if (fin) break;
    if (value) chunks.push(value);
  }
  try {
    return decryptVaultBlob(Buffer.concat(chunks), key);
  } catch (e) {
    logger.error("vault: decrypt failed during zip", e);
    return null;
  }
}

export type { ICompanyFolder };
