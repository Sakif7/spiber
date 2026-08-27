import { connectToDatabase } from "@/lib/db/connect";
import {
  CompanyDocument,
  type ICompanyDocument,
} from "@/lib/models/companyDocument";
import type { Lean } from "@/lib/models/_shared";

type DocFilter = NonNullable<
  Parameters<typeof CompanyDocument.countDocuments>[0]
>;

export async function createCompanyDocument(data: Partial<ICompanyDocument>) {
  await connectToDatabase();
  return CompanyDocument.create(data);
}

export async function getCompanyDocumentById(
  id: string,
): Promise<Lean<ICompanyDocument> | null> {
  await connectToDatabase();
  return CompanyDocument.findOne({ _id: id, deletedAt: null })
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
