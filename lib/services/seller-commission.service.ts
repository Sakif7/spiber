import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import type { IOrder } from "@/lib/models/order";
import type { ISellerPayout } from "@/lib/models/seller-payout";
import {
  createSellerCommission,
  voidAccruedByOrder,
  getCommissionsByIds,
  linkCommissionsToPayout,
  markCommissionsPaidByPayout,
} from "@/lib/repositories/seller-commissions.repo";
import {
  createSellerPayout as repoCreatePayout,
  getSellerPayoutById,
  setPayoutStatus,
} from "@/lib/repositories/seller-payouts.repo";
import { getSellerById } from "@/lib/repositories/sellers.repo";
import {
  getSellerCommissionBp,
  DEFAULT_COMMISSION_BP,
} from "./seller-settings.service";
import { sellerPayoutNumber } from "@/lib/ids";
import { logger } from "@/lib/log";
import type { SellerPayoutStatus } from "@/lib/schemas/seller-commission";

/**
 * Accrue a commission per seller for a PAID order. Idempotent (one row per
 * order+seller, enforced by a unique index). Earnings = the seller's item
 * subtotal − platform commission (rate = the seller's override, else the global
 * default). House/platform items (no sellerId) accrue nothing.
 */
export async function accrueSellerCommissions(
  order: IOrder,
  orderId: string,
): Promise<void> {
  await connectToDatabase();
  // Group this order's item subtotals by seller.
  const bySeller = new Map<string, number>();
  for (const it of order.items) {
    const sid = it.productSnapshot.sellerId
      ? String(it.productSnapshot.sellerId)
      : null;
    if (!sid) continue;
    bySeller.set(sid, (bySeller.get(sid) ?? 0) + it.lineTotalMinor);
  }
  if (bySeller.size === 0) return;

  const globalBp = await getSellerCommissionBp().catch(
    () => DEFAULT_COMMISSION_BP,
  );
  const now = new Date();

  for (const [sellerId, subtotal] of bySeller) {
    const seller = await getSellerById(sellerId).catch(() => null);
    const rateBp =
      typeof seller?.commissionBp === "number" ? seller.commissionBp : globalBp;
    const commission = Math.floor((subtotal * rateBp) / 10000);
    const earnings = subtotal - commission;
    await createSellerCommission({
      orderId: new mongoose.Types.ObjectId(orderId),
      orderNumber: order.orderNumber,
      sellerId: new mongoose.Types.ObjectId(sellerId),
      itemSubtotalMinor: subtotal,
      commissionRateBp: rateBp,
      commissionAmountMinor: commission,
      sellerEarningsMinor: earnings,
      currency: "BDT",
      status: "accrued",
      accruedAt: now,
    }).catch((e) => logger.warn("accrue seller commission failed", e));
  }
}

/** Void a cancelled/refunded order's still-accrued (not-yet-paid) commissions. */
export async function voidSellerCommissions(orderId: string): Promise<void> {
  await voidAccruedByOrder(orderId).catch((e) =>
    logger.warn("void seller commissions failed", e),
  );
}

export type CreatePayoutResult =
  | { ok: true; payout: ISellerPayout; payoutId: string }
  | { ok: false; code: "no_eligible_commissions" };

/**
 * Create a payout for a seller from a set of accrued, un-paid commissions.
 * Validates the commissions belong to the seller and are available, links them
 * to the new (pending) payout; marking the payout paid later flips them to paid.
 */
export async function createSellerPayout(
  sellerId: string,
  commissionIds: string[],
  note?: string,
): Promise<CreatePayoutResult> {
  await connectToDatabase();
  const commissions = await getCommissionsByIds(commissionIds);
  const eligible = commissions.filter(
    (c) =>
      String(c.sellerId) === sellerId && c.status === "accrued" && !c.payoutId,
  );
  if (eligible.length === 0)
    return { ok: false, code: "no_eligible_commissions" };

  const total = eligible.reduce((s, c) => s + c.sellerEarningsMinor, 0);
  const ids = eligible.map((c) => String(c._id));
  const payout = await repoCreatePayout({
    payoutNumber: sellerPayoutNumber(),
    sellerId: new mongoose.Types.ObjectId(sellerId),
    commissionIds: ids.map((i) => new mongoose.Types.ObjectId(i)),
    totalEarningsMinor: total,
    currency: "BDT",
    status: "pending",
    note,
  });
  await linkCommissionsToPayout(ids, String(payout._id));
  return { ok: true, payout: payout.toObject(), payoutId: String(payout._id) };
}

export type UpdatePayoutResult =
  | { ok: true; payout: ISellerPayout }
  | { ok: false; code: "not_found" };

export async function updatePayoutStatus(
  payoutId: string,
  status: SellerPayoutStatus,
  note?: string,
): Promise<UpdatePayoutResult> {
  const payout = await getSellerPayoutById(payoutId);
  if (!payout) return { ok: false, code: "not_found" };
  const updated = await setPayoutStatus(payoutId, status, note);
  // Marking a payout paid settles its linked commissions.
  if (status === "paid") await markCommissionsPaidByPayout(payoutId);
  return { ok: true, payout: (updated ?? payout).toObject() };
}
