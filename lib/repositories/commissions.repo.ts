import { connectToDatabase } from "@/lib/db/connect";
import {
  AffiliateCommission,
  type IAffiliateCommission,
} from "@/lib/models/affiliateCommission";
import type { Lean } from "@/lib/models/_shared";
import type { CommissionStatus } from "@/lib/schemas/systems";

export async function getCommissionByPurchaseId(purchaseId: string) {
  await connectToDatabase();
  return AffiliateCommission.findOne({ purchaseId, deletedAt: null }).exec();
}

export async function getCommissionById(id: string) {
  await connectToDatabase();
  return AffiliateCommission.findOne({ _id: id, deletedAt: null }).exec();
}

export async function createCommission(data: Partial<IAffiliateCommission>) {
  await connectToDatabase();
  return AffiliateCommission.create(data);
}

export async function listCommissions(
  params: { status?: CommissionStatus } = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  return AffiliateCommission.find(q)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean<Lean<IAffiliateCommission>[]>()
    .exec();
}

/** Total accrued (unpaid) commission, in poisha — for the ledger summary. */
export async function commissionTotals() {
  await connectToDatabase();
  const rows = await AffiliateCommission.aggregate<{
    _id: CommissionStatus;
    amountMinor: number;
  }>([
    { $match: { deletedAt: null } },
    { $group: { _id: "$status", amountMinor: { $sum: "$amountMinor" } } },
  ]).exec();
  const by = Object.fromEntries(rows.map((r) => [r._id, r.amountMinor]));
  return {
    accruedMinor: by.accrued ?? 0,
    paidMinor: by.paid ?? 0,
    voidMinor: by.void ?? 0,
  };
}
