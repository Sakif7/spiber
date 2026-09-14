import { z } from "zod";
import {
  DOCUMENT_LANGUAGES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  FONT_SIZES,
} from "@/lib/documents/types";

/**
 * Written documents (notices, letters, memos, agreements): what the API
 * accepts. The body is TipTap JSON — validated for shape here and by the
 * editor schema when it is rendered, so an unknown node cannot get filed.
 */
export const documentTypeEnum = z.enum(DOCUMENT_TYPES);
export const documentStatusEnum = z.enum(DOCUMENT_STATUSES);
export const documentLanguageEnum = z.enum(DOCUMENT_LANGUAGES);

const MAX_BODY_BYTES = 2_000_000;

/** A ProseMirror document: `{ type: "doc", content: [...] }`, bounded in size. */
export const documentBodySchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough()
  .refine((v) => JSON.stringify(v).length <= MAX_BODY_BYTES, {
    message: "document is too large",
  });
export type DocumentBody = z.infer<typeof documentBodySchema>;

/**
 * The page settings, as bare fields: the full schema below adds the
 * defaults, the patch schema must not — Zod's `.partial()` keeps filling
 * defaults for absent keys, and a patch of one field would then arrive
 * complete and reset every other setting on merge.
 */
const settingsFields = {
  /** Company letterhead and footer band on every page. */
  letterhead: z.boolean(),
  /** Running header line under the letterhead; empty = none. */
  header: z.string().trim().max(200),
  /** Footer line above the band; `{{number}}` and `{{title}}` are filled in. */
  footer: z.string().trim().max(200),
  pageNumbers: z.boolean(),
  /** Default body font (an id from DOCUMENT_FONTS) and size in points. */
  font: z.string().max(40),
  fontSize: z.number().refine((n) => FONT_SIZES.includes(n), "unknown size"),
  language: documentLanguageEnum,
};
export const documentSettingsSchema = z.object({
  letterhead: settingsFields.letterhead.default(true),
  header: settingsFields.header.default(""),
  footer: settingsFields.footer.default("{{number}} · {{title}}"),
  pageNumbers: settingsFields.pageNumbers.default(true),
  font: settingsFields.font.default("plex-serif"),
  fontSize: settingsFields.fontSize.default(11),
  language: settingsFields.language.default("en"),
});
export type DocumentSettings = z.infer<typeof documentSettingsSchema>;
/** Only the keys sent are changed. */
export const documentSettingsPatchSchema = z.object(settingsFields).partial();

export const createDocumentSchema = z.object({
  type: documentTypeEnum,
  title: z.string().trim().min(1, "is required").max(200),
  language: documentLanguageEnum.default("en"),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

/** Autosave and settings edits; only for a document that is not yet sent. */
export const updateDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: documentBodySchema.optional(),
    settings: documentSettingsPatchSchema.optional(),
    /** The revision the client last saw; a stale save is refused. */
    rev: z.number().int().min(0).optional(),
  })
  .refine((v) => v.title !== undefined || v.body || v.settings, {
    message: "nothing to change",
  });
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const snapshotSchema = z.object({
  note: z.string().trim().max(200).optional(),
});

export const listDocumentsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: documentTypeEnum.optional(),
  status: documentStatusEnum.optional(),
});

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "must be an id");

/** Send: the slot people sign; these extra people only read it. */
export const sendDocumentSchema = z.object({
  acknowledgers: z.array(objectId).max(200).default([]),
  message: z.string().trim().max(1000).optional(),
});
export type SendDocumentInput = z.infer<typeof sendDocumentSchema>;

/** The recipient's act: name typed as on their record, the box ticked. */
export const acknowledgeDocumentSchema = z.object({
  typedName: z.string().trim().min(1, "Type your name").max(160),
  agree: z.literal(true, "Tick the box to confirm you have read it"),
});
export type AcknowledgeDocumentInput = z.infer<
  typeof acknowledgeDocumentSchema
>;
