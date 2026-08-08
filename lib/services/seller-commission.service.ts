import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import type { IOrder, IOrderItem } from "@/lib/models/order";
import type { ISellerPayout } from "@/lib/models/seller-payout";
import type { ICommissionLine } from "@/lib/models/seller-commission";
import { Product } from "@/lib/models/product";
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
import { resolveCategoryCommissionBp } from "@/lib/repositories/taxonomy.repo";
import {
  getSellerCommissionBp,
  DEFAULT_COMMISSION_BP,
} from "./seller-settings.service";
import {
  notifySellerNewPaidOrder,
  notifySellerPayoutPaid,
} from "./seller-notifications.service";
import { sellerPayoutNumber } from "@/lib/ids";
import { logger } from "@/lib/log";
import type { SellerPayoutStatus } from "@/lib/schemas/seller-commission";

/**
 * Rate precedence for one item: the seller's negotiated override, else the
 * product category's rate (inheriting from ancestor categories), else the
 * admin-set platform default. Exported for tests.
 */
export async function resolveItemRateBp(
  sellerOverrideBp: number | null | undefined,
  categoryId: string | null,
  globalBp: number,
): Promise<{ rateBp: number; source: ICommissionLine["rateSource"] }> {
  if (typeof sellerOverrideBp === "number") {
    return { rateBp: sellerOverrideBp, source: "seller" };
  }
  if (categoryId) {
    const catBp = await resolveCategoryCommissionBp(categoryId).catch(
      () => null,
    );
    if (typeof catBp === "number") return { rateBp: catBp, source: "category" };
  }
  return { rateBp: globalBp, source: "global" };
}

/**
 * Accrue a commission per seller for a PAID order. Idempotent (one row per
 * order+seller, enforced by a unique index). Earnings = the seller's item
 * subtotal − platform commission, computed PER ITEM (rates can differ by
 * category), with the full per-line breakdown stored on the ledger row.
 * House/platform items (no sellerId) accrue nothing. Emails the seller.
 */
export async function accrueSellerCommissions(
  order: IOrder,
  orderId: string,
): Promise<void> {
  await connectToDatabase();
  // Group this order's items by seller.
  const bySeller = new Map<string, IOrderItem[]>();
  for (const it of order.items) {
    const sid = it.productSnapshot.sellerId
      ? String(it.productSnapshot.sellerId)
      : null;
    if (!sid) continue;
    const list = bySeller.get(sid) ?? [];
    list.push(it);
    bySeller.set(sid, list);
  }
  if (bySeller.size === 0) return;

  const globalBp = await getSellerCommissionBp().catch(
    () => DEFAULT_COMMISSION_BP,
  );

  // Category ids for rate lookup — the order snapshot predates category rates,
  // so resolve through the product docs (missing/deleted product → global rate).
  const productIds = [...bySeller.values()]
    .flat()
    .map((it) => it.productId)
    .filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } })
    .select("categoryId")
    .lean<{ _id: mongoose.Types.ObjectId; categoryId?: unknown }[]>()
    .exec()
    .catch(() => []);
  const categoryByProduct = new Map(
    products.map((p) => [
      String(p._id),
      p.categoryId ? String(p.categoryId) : null,
    ]),
  );

  const now = new Date();

  for (const [sellerId, items] of bySeller) {
    const seller = await getSellerById(sellerId).catch(() => null);
    const overrideBp =
      typeof seller?.commissionBp === "number" ? seller.commissionBp : null;

    const lines: ICommissionLine[] = [];
    for (const it of items) {
      const categoryId = it.productId
        ? (categoryByProduct.get(String(it.productId)) ?? null)
        : null;
      const { rateBp, source } = await resolveItemRateBp(
        overrideBp,
        categoryId,
        globalBp,
      );
      lines.push({
        productId: it.productId,
        name: it.productSnapshot.name.en,
        qty: it.qty,
        subtotalMinor: it.lineTotalMinor,
        rateBp,
        rateSource: source,
        commissionMinor: Math.floor((it.lineTotalMinor * rateBp) / 10000),
      });
    }

    const subtotal = lines.reduce((s, l) => s + l.subtotalMinor, 0);
    const commission = lines.reduce((s, l) => s + l.commissionMinor, 0);
    const earnings = subtotal - commission;
    // Effective (blended) rate for display; exact per-line rates live in lines.
    const effectiveBp =
      subtotal > 0 ? Math.round((commission * 10000) / subtotal) : globalBp;

    const created = await createSellerCommission({
      orderId: new mongoose.Types.ObjectId(orderId),
      orderNumber: order.orderNumber,
      sellerId: new mongoose.Types.ObjectId(sellerId),
      itemSubtotalMinor: subtotal,
      commissionRateBp: effectiveBp,
      commissionAmountMinor: commission,
      sellerEarningsMinor: earnings,
      lines,
      currency: "BDT",
      status: "accrued",
      accruedAt: now,
    }).catch((e) => {
      logger.warn("accrue seller commission failed", e);
      return null;
    });

    // "You made a sale" — only on a fresh accrual (not an idempotent replay).
    if (created && seller) {
      await notifySellerNewPaidOrder(seller, {
        orderNumber: order.orderNumber,
        itemSubtotalMinor: subtotal,
        commissionAmountMinor: commission,
        sellerEarningsMinor: earnings,
        lines,
      });
    }
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
  const wasPaid = payout.status === "paid";
  const updated = await setPayoutStatus(payoutId, status, note);
  // Marking a payout paid settles its linked commissions + notifies the seller.
  if (status === "paid") {
    await markCommissionsPaidByPayout(payoutId);
    if (!wasPaid) {
      const seller = await getSellerById(String(payout.sellerId)).catch(
        () => null,
      );
      if (seller) {
        await notifySellerPayoutPaid(seller, {
          payoutNumber: payout.payoutNumber,
          totalEarningsMinor: payout.totalEarningsMinor,
        });
      }
    }
  }
  return { ok: true, payout: (updated ?? payout).toObject() };
}
