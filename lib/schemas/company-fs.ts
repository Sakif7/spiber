import { z } from "zod";
import { FOLDER_NAME_RE } from "@/lib/models/companyFolder";

/**
 * Input contracts for the company file manager. The service enforces the
 * structural rules (no folder inside itself, name collisions, quota); these
 * schemas only guarantee the shape and the bounds.
 */

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be an id")
  .describe("ObjectId");

/** A folder id, or null for the vault root. */
export const folderRef = objectId.nullable();

export const folderNameSchema = z
  .string()
  .trim()
  .min(1, "is required")
  .max(120)
  .regex(FOLDER_NAME_RE, 'cannot contain / \\ : * ? " < > |');

export const folderCreateSchema = z.object({
  name: folderNameSchema,
  parentId: folderRef.optional().default(null),
});
export type FolderCreateInput = z.infer<typeof folderCreateSchema>;

/** Rename and/or move. Both optional so the UI can send just one. */
export const folderUpdateSchema = z
  .object({
    name: folderNameSchema.optional(),
    parentId: folderRef.optional(),
  })
  .refine((v) => v.name !== undefined || v.parentId !== undefined, {
    message: "nothing to update",
  });
export type FolderUpdateInput = z.infer<typeof folderUpdateSchema>;

/** Rename and/or re-file a document. The binary itself never changes. */
export const documentUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "is required").max(200).optional(),
    folderId: folderRef.optional(),
  })
  .refine((v) => v.title !== undefined || v.folderId !== undefined, {
    message: "nothing to update",
  });
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;

export const moveTargetSchema = z.object({ targetId: folderRef });

/** How many items one bulk call may touch — keeps a request bounded. */
export const BULK_LIMIT = 200;

export const bulkSchema = z
  .object({
    op: z.enum(["move", "copy", "trash", "restore", "purge"]),
    folderIds: z.array(objectId).max(BULK_LIMIT).default([]),
    fileIds: z.array(objectId).max(BULK_LIMIT).default([]),
    /** Destination for move/copy; ignored otherwise. */
    targetId: folderRef.optional().default(null),
  })
  .refine((v) => v.folderIds.length + v.fileIds.length > 0, {
    message: "select at least one item",
  })
  .refine((v) => v.folderIds.length + v.fileIds.length <= BULK_LIMIT, {
    message: `at most ${BULK_LIMIT} items at once`,
  });
export type BulkInput = z.infer<typeof bulkSchema>;

export const FS_SORTS = ["name", "size", "type", "modified"] as const;
export type FsSort = (typeof FS_SORTS)[number];

/**
 * Listing options. Parsed from the query string, so everything arrives as a
 * string and the booleans are "1"/"0".
 */
export const listQuerySchema = z.object({
  folder: objectId.nullish(),
  sort: z.enum(FS_SORTS).default("name"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  q: z.string().trim().max(120).optional(),
  /** Search the whole subtree rather than just this folder. */
  recursive: z.coerce.boolean().default(false),
  /** Show trashed items instead of live ones. */
  trash: z.coerce.boolean().default(false),
});
export type ListQueryInput = z.infer<typeof listQuerySchema>;
