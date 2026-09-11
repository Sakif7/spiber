import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { PdfTemplate, type IPdfTemplate } from "@/lib/models/pdfTemplate";
import type { Lean } from "@/lib/models/_shared";
import type { TemplateDoc, TemplateKind } from "@/lib/schemas/pdf-template";

const oid = (id: string) => new mongoose.Types.ObjectId(id);

export type PublishedSummary = {
  version: number;
  publishedAt: Date | null;
  publishedBy: string | null;
  note: string | null;
  baseVersion: number | null;
};

export async function getDraft(
  kind: TemplateKind,
): Promise<Lean<IPdfTemplate> | null> {
  await connectToDatabase();
  return PdfTemplate.findOne({ kind, status: "draft" })
    .lean<Lean<IPdfTemplate>>()
    .exec();
}

export async function getLatestPublished(
  kind: TemplateKind,
): Promise<Lean<IPdfTemplate> | null> {
  await connectToDatabase();
  return PdfTemplate.findOne({ kind, status: "published" })
    .sort({ version: -1 })
    .lean<Lean<IPdfTemplate>>()
    .exec();
}

export async function getPublishedVersion(
  kind: TemplateKind,
  version: number,
): Promise<Lean<IPdfTemplate> | null> {
  await connectToDatabase();
  return PdfTemplate.findOne({ kind, status: "published", version })
    .lean<Lean<IPdfTemplate>>()
    .exec();
}

export async function listPublished(
  kind: TemplateKind,
): Promise<PublishedSummary[]> {
  await connectToDatabase();
  const rows = await PdfTemplate.find({ kind, status: "published" })
    .sort({ version: -1 })
    .select({
      version: 1,
      publishedAt: 1,
      publishedBy: 1,
      note: 1,
      baseVersion: 1,
    })
    .lean<Lean<IPdfTemplate>[]>()
    .exec();
  return rows.map((r) => ({
    version: r.version ?? 0,
    publishedAt: r.publishedAt ?? null,
    publishedBy: r.publishedBy ? String(r.publishedBy) : null,
    note: r.note ?? null,
    baseVersion: r.baseVersion ?? null,
  }));
}

export async function maxPublishedVersion(kind: TemplateKind): Promise<number> {
  const latest = await getLatestPublished(kind);
  return latest?.version ?? 0;
}

/** Create or overwrite the one draft for a kind. */
export async function upsertDraft(
  kind: TemplateKind,
  doc: TemplateDoc,
  actorId: string,
  baseVersion: number | null,
): Promise<Lean<IPdfTemplate>> {
  await connectToDatabase();
  const row = await PdfTemplate.findOneAndUpdate(
    { kind, status: "draft" },
    {
      $set: {
        documentTitle: doc.documentTitle,
        theme: doc.theme,
        blocks: doc.blocks,
        updatedBy: oid(actorId),
        ...(baseVersion != null ? { baseVersion } : {}),
      },
      $setOnInsert: {
        kind,
        status: "draft",
        version: null,
        createdBy: oid(actorId),
      },
    },
    { upsert: true, returnDocument: "after" },
  )
    .lean<Lean<IPdfTemplate>>()
    .exec();
  return row!;
}

export async function deleteDraft(kind: TemplateKind): Promise<boolean> {
  await connectToDatabase();
  const res = await PdfTemplate.deleteOne({ kind, status: "draft" }).exec();
  return res.deletedCount > 0;
}

/**
 * Turn the draft into published version `version`, only if it is still a
 * draft. Returns null when it was discarded or published meanwhile.
 */
export async function publishDraft(
  draftId: string,
  version: number,
  actorId: string,
  note: string | null,
): Promise<Lean<IPdfTemplate> | null> {
  await connectToDatabase();
  return PdfTemplate.findOneAndUpdate(
    { _id: oid(draftId), status: "draft" },
    {
      $set: {
        status: "published",
        version,
        note,
        publishedAt: new Date(),
        publishedBy: oid(actorId),
      },
    },
    { returnDocument: "after" },
  )
    .lean<Lean<IPdfTemplate>>()
    .exec();
}
