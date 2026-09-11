import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { connectToDatabase } from "@/lib/db/connect";
import { logger } from "@/lib/log";
import {
  decryptVaultBlob,
  encryptVaultBlob,
  getVaultKey,
} from "@/lib/crypto/vault";
import { PdfAsset, type IPdfAsset } from "@/lib/models/pdfAsset";
import { PdfTemplate } from "@/lib/models/pdfTemplate";
import type { Lean } from "@/lib/models/_shared";
import { getStorage } from "@/lib/storage";
import { sniffKind } from "@/lib/uploads/sniff";
import type { StampAsset as LoadedAsset } from "@/lib/pdf/types";

export type { LoadedAsset };

/**
 * Stamp images for PDF templates: upload, list, read back, delete.
 *
 * PNG only — it is what a scanned seal or signature is exported as, it keeps
 * its transparency over the page, and its header states the pixel size, which
 * the renderer needs to keep the aspect ratio. Encrypted at rest with the
 * company vault key, like every other document that could be used to
 * impersonate the company.
 */

export const MAX_ASSET_BYTES = 2 * 1024 * 1024;

export type AssetError =
  | "vault_not_configured"
  | "bad_type"
  | "too_large"
  | "not_found"
  | "in_use";
export type AssetResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AssetError };
const fail = (code: AssetError): AssetResult<never> => ({ ok: false, code });
const done = <T>(data: T): AssetResult<T> => ({ ok: true, data });

export type AssetSummary = {
  id: string;
  name: string;
  width: number;
  height: number;
  size: number;
  createdAt: Date;
};

const oid = (id: string) => new mongoose.Types.ObjectId(id);

function summary(row: Lean<IPdfAsset>): AssetSummary {
  return {
    id: String(row._id),
    name: row.name,
    width: row.width,
    height: row.height,
    size: row.size,
    createdAt: row.createdAt,
  };
}

/** Width and height from a PNG's IHDR chunk, which always comes first. */
export function pngDimensions(
  buf: Buffer,
): { width: number; height: number } | null {
  if (buf.length < 24 || sniffKind(buf) !== "png") return null;
  if (buf.subarray(12, 16).toString("latin1") !== "IHDR") return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 20_000 || height > 20_000) return null;
  return { width, height };
}

export async function listAssets(): Promise<AssetSummary[]> {
  await connectToDatabase();
  const rows = await PdfAsset.find({ deletedAt: null })
    .sort({ createdAt: -1 })
    .lean<Lean<IPdfAsset>[]>()
    .exec();
  return rows.map(summary);
}

export async function uploadAsset(
  input: { name: string; body: Buffer },
  actor: { sub: string },
): Promise<AssetResult<AssetSummary>> {
  const key = getVaultKey();
  if (!key) return fail("vault_not_configured");
  if (input.body.length > MAX_ASSET_BYTES) return fail("too_large");
  const dims = pngDimensions(input.body);
  if (!dims) return fail("bad_type");

  const fileKey = `pdf-assets/${randomBytes(16).toString("hex")}.bin`;
  await getStorage().put({
    key: fileKey,
    body: encryptVaultBlob(input.body, key),
    contentType: "application/octet-stream",
    private: true,
  });
  await connectToDatabase();
  const row = await PdfAsset.create({
    name: input.name.trim().slice(0, 120) || "Stamp",
    fileKey,
    contentType: "image/png",
    size: input.body.length,
    width: dims.width,
    height: dims.height,
    createdBy: oid(actor.sub),
  });
  return done(summary(row.toObject() as Lean<IPdfAsset>));
}

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Decrypt one asset into memory. Null when it is gone or unreadable — a
 * stamp that cannot be drawn is left off the page, never a failed invoice.
 */
export async function loadAsset(id: string): Promise<LoadedAsset | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const key = getVaultKey();
  if (!key) return null;
  await connectToDatabase();
  const row = await PdfAsset.findOne({ _id: oid(id), deletedAt: null })
    .lean<Lean<IPdfAsset>>()
    .exec();
  if (!row) return null;
  try {
    const obj = await getStorage().getObject({ key: row.fileKey });
    if (!obj) return null;
    const data = decryptVaultBlob(await streamToBuffer(obj.body), key);
    return { data, width: row.width, height: row.height };
  } catch (err) {
    logger.warn("pdf-asset: could not load", { id, err });
    return null;
  }
}

/** Every asset a template needs, keyed by id; missing ones are simply absent. */
export async function loadAssets(
  ids: string[],
): Promise<Record<string, LoadedAsset>> {
  const out: Record<string, LoadedAsset> = {};
  await Promise.all(
    ids.map(async (id) => {
      const a = await loadAsset(id);
      if (a) out[id] = a;
    }),
  );
  return out;
}

/** Which templates (draft or published) still stamp this asset. */
export async function assetReferences(id: string): Promise<number> {
  await connectToDatabase();
  return PdfTemplate.countDocuments({
    blocks: { $elemMatch: { type: "stamp", "props.assetId": id } },
  }).exec();
}

export async function deleteAsset(
  id: string,
): Promise<AssetResult<{ deleted: true }>> {
  if (!mongoose.isValidObjectId(id)) return fail("not_found");
  if ((await assetReferences(id)) > 0) return fail("in_use");
  await connectToDatabase();
  const res = await PdfAsset.updateOne(
    { _id: oid(id), deletedAt: null },
    { $set: { deletedAt: new Date() } },
  ).exec();
  if (res.matchedCount === 0) return fail("not_found");
  return done({ deleted: true });
}
