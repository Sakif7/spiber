import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Employee, type IEmployee } from "@/lib/models/employee";
import type { Lean } from "@/lib/models/_shared";
import { writeAudit } from "@/lib/repositories/audit.repo";
import {
  loadAsset,
  uploadAsset,
  MAX_ASSET_BYTES,
  type LoadedAsset,
} from "@/lib/services/pdf-asset.service";
import { logger } from "@/lib/log";

/**
 * One signature per employee, kept as an encrypted `PdfAsset` of kind
 * "signature" and pointed to from the Employee record. It is set when the
 * record is created (optional), later from the employee's page, or by the
 * person in their own portal; every change is audited and lands in the
 * employee's activity. Documents freeze the asset id they were signed with,
 * so an old signature is never deleted — a replaced one simply stops being
 * the current one.
 */
export type Actor = { sub: string; email: string };

export type SignatureError =
  | "not_found"
  | "bad_image"
  | "too_large"
  | "vault_not_configured";
export type SignatureResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: SignatureError };

export type SignatureInfo = {
  assetId: string;
  updatedAt: Date | null;
  width: number;
  height: number;
};

const oid = (id: string) => new mongoose.Types.ObjectId(id);

/** A `data:image/png;base64,…` string (what the forms send) → bytes. */
export function pngFromDataUrl(dataUrl: string): Buffer | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

export async function setEmployeeSignature(
  employeeId: string,
  png: Buffer,
  actor: Actor,
  opts: { source: "upload" | "draw"; self?: boolean; req?: Request },
): Promise<SignatureResult<SignatureInfo>> {
  if (!mongoose.isValidObjectId(employeeId))
    return { ok: false, code: "not_found" };
  if (png.length > MAX_ASSET_BYTES) return { ok: false, code: "too_large" };
  await connectToDatabase();
  const employee = await Employee.findOne({
    _id: oid(employeeId),
    deletedAt: null,
  })
    .lean<Lean<IEmployee>>()
    .exec();
  if (!employee) return { ok: false, code: "not_found" };

  const uploaded = await uploadAsset(
    { name: `Signature — ${employee.name}`, body: png, kind: "signature" },
    actor,
  );
  if (!uploaded.ok) {
    return {
      ok: false,
      code:
        uploaded.code === "bad_type"
          ? "bad_image"
          : uploaded.code === "too_large"
            ? "too_large"
            : "vault_not_configured",
    };
  }
  const now = new Date();
  const replaced = Boolean(employee.signatureAssetId);
  const action = replaced ? "signature.replaced" : "signature.set";
  const note =
    opts.source === "draw" ? "drawn in the browser" : "uploaded image";
  await Employee.updateOne(
    { _id: oid(employeeId) },
    {
      $set: {
        signatureAssetId: oid(uploaded.data.id),
        signatureUpdatedAt: now,
      },
      $push: {
        activity: {
          at: now,
          actorId: oid(actor.sub),
          action,
          note: `${note}${opts.self ? " (by the employee)" : ""}`,
        },
      },
    },
  ).exec();
  await writeAudit(
    {
      actorId: actor.sub,
      action: `employee.${action}`,
      entityType: "Employee",
      entityId: employeeId,
      after: {
        assetId: uploaded.data.id,
        source: opts.source,
        self: Boolean(opts.self),
      },
    },
    opts.req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  return {
    ok: true,
    data: {
      assetId: uploaded.data.id,
      updatedAt: now,
      width: uploaded.data.width,
      height: uploaded.data.height,
    },
  };
}

export async function clearEmployeeSignature(
  employeeId: string,
  actor: Actor,
  opts: { self?: boolean; req?: Request } = {},
): Promise<SignatureResult<true>> {
  if (!mongoose.isValidObjectId(employeeId))
    return { ok: false, code: "not_found" };
  await connectToDatabase();
  const now = new Date();
  const res = await Employee.updateOne(
    { _id: oid(employeeId), deletedAt: null },
    {
      $set: { signatureAssetId: null, signatureUpdatedAt: now },
      $push: {
        activity: {
          at: now,
          actorId: oid(actor.sub),
          action: "signature.removed",
          note: opts.self ? "by the employee" : null,
        },
      },
    },
  ).exec();
  if (res.matchedCount === 0) return { ok: false, code: "not_found" };
  await writeAudit(
    {
      actorId: actor.sub,
      action: "employee.signature.removed",
      entityType: "Employee",
      entityId: employeeId,
      after: { self: Boolean(opts.self) },
    },
    opts.req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  return { ok: true, data: true };
}

/** The current signature's id and size, or null when none is stored. */
export async function employeeSignatureInfo(
  employeeId: string,
): Promise<SignatureInfo | null> {
  if (!mongoose.isValidObjectId(employeeId)) return null;
  await connectToDatabase();
  const employee = await Employee.findOne({
    _id: oid(employeeId),
    deletedAt: null,
  })
    .select("signatureAssetId signatureUpdatedAt")
    .lean<Pick<Lean<IEmployee>, "signatureAssetId" | "signatureUpdatedAt">>()
    .exec();
  if (!employee?.signatureAssetId) return null;
  const asset = await loadAsset(String(employee.signatureAssetId));
  if (!asset) return null;
  return {
    assetId: String(employee.signatureAssetId),
    updatedAt: employee.signatureUpdatedAt ?? null,
    width: asset.width,
    height: asset.height,
  };
}

/** The decrypted PNG of an employee's current signature, or null. */
export async function loadEmployeeSignature(
  employeeId: string,
): Promise<(LoadedAsset & { assetId: string }) | null> {
  if (!mongoose.isValidObjectId(employeeId)) return null;
  await connectToDatabase();
  const employee = await Employee.findOne({
    _id: oid(employeeId),
    deletedAt: null,
  })
    .select("signatureAssetId")
    .lean<Pick<Lean<IEmployee>, "signatureAssetId">>()
    .exec();
  if (!employee?.signatureAssetId) return null;
  const asset = await loadAsset(String(employee.signatureAssetId));
  return asset
    ? { ...asset, assetId: String(employee.signatureAssetId) }
    : null;
}
