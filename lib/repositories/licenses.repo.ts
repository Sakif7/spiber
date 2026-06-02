import { connectToDatabase } from "@/lib/db/connect";
import { License, type ILicense } from "@/lib/models/license";
import type { Lean } from "@/lib/models/_shared";
import type { LicenseStatus } from "@/lib/schemas/systems";

export async function getLicenseByPurchaseId(purchaseId: string) {
  await connectToDatabase();
  return License.findOne({ purchaseId }).exec();
}

export async function getLicenseById(id: string) {
  await connectToDatabase();
  return License.findById(id).exec();
}

export async function listLicensesByUser(userId: string) {
  await connectToDatabase();
  return License.find({ userId })
    .sort({ createdAt: -1 })
    .lean<Lean<ILicense>[]>()
    .exec();
}

export async function listLicenses(params: { status?: LicenseStatus } = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.status) q.status = params.status;
  return License.find(q)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean<Lean<ILicense>[]>()
    .exec();
}

export async function createLicense(data: Partial<ILicense>) {
  await connectToDatabase();
  return License.create(data);
}

export async function setLicenseStatus(id: string, status: LicenseStatus) {
  await connectToDatabase();
  return License.findByIdAndUpdate(id, { status }, { new: true }).exec();
}
