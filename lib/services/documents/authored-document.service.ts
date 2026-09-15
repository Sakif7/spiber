import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  AuthoredDocument,
  type IAuthoredDocument,
  type IDocumentVersion,
} from "@/lib/models/authored-document";
import { Counter } from "@/lib/models/counter";
import type { Lean } from "@/lib/models/_shared";
import { writeAudit } from "@/lib/repositories/audit.repo";
import {
  ensureFolderPath,
  uploadDocument,
  type Actor,
} from "@/lib/services/company-fs.service";
export type { Actor };
import {
  DOCUMENT_NUMBER_PREFIX,
  DOCUMENT_TYPE_LABEL,
  type DocumentStatus,
  type DocumentType,
} from "@/lib/documents/types";
import {
  bodyToHtml,
  emptyBody,
  stripSignatureState,
} from "@/lib/documents/render";
import { stripMergeValues } from "@/lib/documents/merge";
import { renderDocumentPdf } from "@/lib/documents/print/pdf";
import {
  documentSettingsSchema,
  type CreateDocumentInput,
  type DocumentSettings,
  type UpdateDocumentInput,
} from "@/lib/schemas/authored-document";
import { logger } from "@/lib/log";

/**
 * Written documents: the draft that is being typed, and the immutable
 * versions filed from it. Every filing renders the PDF through Chromium and
 * stores it encrypted in the vault under
 * `Company / Documents / <Kind> / <Year>`; the document row keeps the body
 * snapshot, the vault file id and the PDF hash, so what was filed can
 * always be reproduced and checked.
 */
export type DocumentRow = Lean<IAuthoredDocument>;

export type DocumentError =
  | "not_found"
  | "locked"
  | "stale"
  | "invalid_body"
  | "invalid_input"
  | "print_failed"
  | "vault_failed";

export type DocumentResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: DocumentError; detail?: string };

const oid = (id: string) => new mongoose.Types.ObjectId(id);
const valid = (id: string) => mongoose.Types.ObjectId.isValid(id);

const EDITABLE_STATUSES: DocumentStatus[] = ["draft", "in_review"];
const EDITABLE = new Set<string>(EDITABLE_STATUSES);

function event(actor: Actor, action: string, note?: string) {
  return {
    at: new Date(),
    actorId: oid(actor.sub),
    action,
    note: note ?? null,
  };
}

export async function createDocument(
  input: CreateDocumentInput,
  actor: Actor,
  req?: Request,
): Promise<DocumentRow> {
  await connectToDatabase();
  const settings: DocumentSettings = documentSettingsSchema.parse({
    language: input.language,
    font: input.language === "bn" ? "bengali" : "plex-serif",
  });
  const doc = await AuthoredDocument.create({
    type: input.type,
    title: input.title,
    status: "draft",
    authorId: oid(actor.sub),
    body: emptyBody(),
    rev: 0,
    settings,
    activity: [event(actor, "document.create")],
  });
  await writeAudit(
    {
      actorId: actor.sub,
      action: "document.create",
      entityType: "AuthoredDocument",
      entityId: String(doc._id),
      after: { type: input.type, title: input.title },
    },
    req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  return doc.toObject() as DocumentRow;
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  if (!valid(id)) return null;
  await connectToDatabase();
  return AuthoredDocument.findOne({ _id: oid(id), deletedAt: null })
    .lean<DocumentRow>()
    .exec();
}

export type DocumentListRow = Pick<
  DocumentRow,
  | "_id"
  | "type"
  | "number"
  | "title"
  | "status"
  | "updatedAt"
  | "createdAt"
  | "sentAt"
> & { versions: number; recipients: number; pending: number };

export async function listDocuments(filter: {
  q?: string;
  type?: DocumentType;
  status?: string;
  limit?: number;
}): Promise<DocumentListRow[]> {
  await connectToDatabase();
  const where: Record<string, unknown> = { deletedAt: null };
  if (filter.type) where.type = filter.type;
  if (filter.status) where.status = filter.status;
  if (filter.q) {
    const rx = new RegExp(filter.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    where.$or = [{ title: rx }, { number: rx }];
  }
  const rows = await AuthoredDocument.find(where)
    .sort({ updatedAt: -1 })
    .limit(Math.min(500, filter.limit ?? 200))
    .select(
      "type number title status updatedAt createdAt sentAt versions.n recipients.status",
    )
    .lean<DocumentRow[]>()
    .exec();
  return rows.map((r) => ({
    _id: r._id,
    type: r.type,
    number: r.number ?? null,
    title: r.title,
    status: r.status,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
    sentAt: r.sentAt ?? null,
    versions: r.versions?.length ?? 0,
    recipients: r.recipients?.length ?? 0,
    pending: (r.recipients ?? []).filter((x) => x.status === "pending").length,
  }));
}

/**
 * Autosave. Refused once the document is sent (`locked`), or when the
 * client's revision is behind (`stale`): a second tab must reload, never
 * overwrite. The body is rendered once to prove the schema accepts it.
 */
export async function updateDocument(
  id: string,
  input: UpdateDocumentInput,
  actor: Actor,
): Promise<DocumentResult<{ rev: number; updatedAt: Date }>> {
  const doc = await getDocument(id);
  if (!doc) return { ok: false, code: "not_found" };
  if (!EDITABLE.has(doc.status)) return { ok: false, code: "locked" };
  if (input.rev !== undefined && input.rev !== doc.rev) {
    return { ok: false, code: "stale" };
  }
  if (input.body) {
    try {
      bodyToHtml(input.body);
    } catch (e) {
      return { ok: false, code: "invalid_body", detail: String(e) };
    }
  }
  const set: Record<string, unknown> = {};
  if (input.title !== undefined) set.title = input.title;
  // Signed-slot images and merge values are render-time state; the stored
  // body never has them.
  if (input.body) set.body = stripMergeValues(stripSignatureState(input.body));
  if (input.mergeEmployeeId !== undefined) {
    set.mergeEmployeeId = input.mergeEmployeeId
      ? oid(input.mergeEmployeeId)
      : null;
  }
  if (input.settings) {
    set.settings = documentSettingsSchema.parse({
      ...doc.settings,
      ...input.settings,
    });
  }
  await connectToDatabase();
  const updated = await AuthoredDocument.findOneAndUpdate(
    { _id: oid(id), rev: doc.rev, status: { $in: EDITABLE_STATUSES } },
    { $set: set, $inc: { rev: 1 } },
    { returnDocument: "after" },
  )
    .select("rev updatedAt")
    .lean<{ rev: number; updatedAt: Date }>()
    .exec();
  if (!updated) return { ok: false, code: "stale" };
  void actor;
  return { ok: true, data: { rev: updated.rev, updatedAt: updated.updatedAt } };
}

/** `SPM-NTC-2026-014`: the counter is per kind and never resets. */
export async function nextDocumentNumber(type: DocumentType): Promise<string> {
  await connectToDatabase();
  const counterId = `document:${type}`;
  const row = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 }, $setOnInsert: { _id: counterId } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean<{ seq: number }>();
  const seq = row?.seq ?? 1;
  return `SPM-${DOCUMENT_NUMBER_PREFIX[type]}-${new Date().getFullYear()}-${String(seq).padStart(3, "0")}`;
}

/** The document as PDF bytes — a preview, nothing is filed. */
export async function renderDraftPdf(
  doc: DocumentRow,
  printBody: IAuthoredDocument["body"] = doc.body,
): Promise<DocumentResult<{ pdf: Buffer; pages: number }>> {
  try {
    const out = await renderDocumentPdf({
      body: printBody,
      settings: documentSettingsSchema.parse(doc.settings ?? {}),
      number: doc.number ?? null,
      title: doc.title,
    });
    return { ok: true, data: { pdf: out.pdf, pages: out.pages } };
  } catch (e) {
    return { ok: false, code: "print_failed", detail: String(e) };
  }
}

/**
 * File the current body as an immutable version: render the PDF, store it
 * encrypted in the vault, append the version with its hash. `snapshot`
 * while drafting; `sent` / `completed` are written by the signing flow.
 */
export async function fileVersion(
  id: string,
  label: IDocumentVersion["label"],
  actor: Actor,
  opts: {
    note?: string;
    req?: Request;
    body?: IAuthoredDocument["body"];
    /**
     * What to print, when it differs from what is stored — the body with
     * the given signatures drawn in. The version keeps the plain body; the
     * signatures live on the recipient rows and in the PDF itself.
     */
    printBody?: IAuthoredDocument["body"];
  } = {},
): Promise<
  DocumentResult<{ version: number; vaultFileId: string; pages: number }>
> {
  const doc = await getDocument(id);
  if (!doc) return { ok: false, code: "not_found" };
  const body = opts.body ?? doc.body;
  const settings = documentSettingsSchema.parse(doc.settings ?? {});
  let printed;
  try {
    printed = await renderDocumentPdf({
      body: opts.printBody ?? body,
      settings,
      number: doc.number ?? null,
      title: doc.title,
    });
  } catch (e) {
    return { ok: false, code: "print_failed", detail: String(e) };
  }
  const n = (doc.versions?.length ?? 0) + 1;
  const year = String(new Date().getFullYear());
  const folder = await ensureFolderPath(
    ["Company", "Documents", `${DOCUMENT_TYPE_LABEL[doc.type]}s`, year],
    actor,
  );
  if (!folder.ok)
    return { ok: false, code: "vault_failed", detail: folder.code };
  const stem = (doc.number ?? doc.title).replace(/[^\w.-]+/g, "-").slice(0, 80);
  const stored = await uploadDocument(
    {
      filename: `${stem}-v${n}.pdf`,
      contentType: "application/pdf",
      body: printed.pdf,
      folderId: folder.data.id,
      source: { kind: "authoredDocument", id },
    },
    actor,
  );
  if (!stored.ok)
    return { ok: false, code: "vault_failed", detail: stored.code };
  const version: IDocumentVersion = {
    n,
    label,
    note: opts.note ?? null,
    body,
    vaultFileId: oid(stored.id),
    pdfSha256: printed.sha256,
    pages: printed.pages,
    createdAt: new Date(),
    createdBy: oid(actor.sub),
  };
  await connectToDatabase();
  await AuthoredDocument.updateOne(
    { _id: oid(id) },
    {
      $push: {
        versions: version,
        activity: event(actor, `document.version.${label}`, opts.note),
      },
    },
  ).exec();
  await writeAudit(
    {
      actorId: actor.sub,
      action: `document.version.${label}`,
      entityType: "AuthoredDocument",
      entityId: id,
      after: {
        version: n,
        vaultFileId: stored.id,
        sha256: printed.sha256,
        pages: printed.pages,
      },
    },
    opts.req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  return {
    ok: true,
    data: { version: n, vaultFileId: stored.id, pages: printed.pages },
  };
}

/** Soft delete of a draft; a sent document is never deleted, only voided. */
export async function deleteDraft(
  id: string,
  actor: Actor,
  req?: Request,
): Promise<DocumentResult<{ deleted: true }>> {
  const doc = await getDocument(id);
  if (!doc) return { ok: false, code: "not_found" };
  // Once numbered it is a record (it went out), even while reissued as a
  // draft — it can be voided later, never deleted.
  if (!EDITABLE.has(doc.status) || doc.number) {
    return { ok: false, code: "locked" };
  }
  await connectToDatabase();
  await AuthoredDocument.updateOne(
    { _id: oid(id) },
    {
      $set: { deletedAt: new Date() },
      $push: { activity: event(actor, "document.delete") },
    },
  ).exec();
  await writeAudit(
    {
      actorId: actor.sub,
      action: "document.delete",
      entityType: "AuthoredDocument",
      entityId: id,
      before: { title: doc.title, status: doc.status },
    },
    req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  return { ok: true, data: { deleted: true } };
}
