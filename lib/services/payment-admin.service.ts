import mongoose from "mongoose";
import {
  claimAttempt,
  getAttemptById,
  type LeanAttempt,
} from "@/lib/repositories/payment-attempts.repo";
import type {
  PaymentFeeCorrectionInput,
  PaymentRefundInput,
} from "@/lib/schemas/payment";

/**
 * Company › Payments: what a super admin does to a payment by hand. Nothing
 * here moves money — PayStation has no refund API — it records what was done
 * outside, so the books and the Needs-refund queue tell the truth.
 */

export type AttemptAdminResult =
  | { ok: true; attempt: LeanAttempt }
  | { ok: false; code: "not_found" | "not_refundable" | "no_fee" };

/**
 * The money waiting under Needs refund went back (bKash, bank, PayStation's
 * panel): record how. A payment applied to an order is refunded from the
 * order's own Refund action instead, which also restocks it.
 */
export async function recordAttemptRefund(
  id: string,
  input: PaymentRefundInput,
  actorId: string,
): Promise<AttemptAdminResult> {
  const current = await getAttemptById(id);
  if (!current) return { ok: false, code: "not_found" };
  const done = await claimAttempt(current._id, ["needs_refund"], {
    status: "refunded",
    refund: {
      reference: input.reference,
      note: input.note,
      at: new Date(),
      by: new mongoose.Types.ObjectId(actorId),
    },
  });
  return done
    ? { ok: true, attempt: done }
    : { ok: false, code: "not_refundable" };
}

/**
 * Set a payment's fee to what PayStation's statement says. The fee was
 * frozen from the rate table when the payment settled; this replaces it for
 * this one payment, and says who did it.
 */
export async function correctAttemptFee(
  id: string,
  input: PaymentFeeCorrectionInput,
  actorId: string,
): Promise<AttemptAdminResult> {
  const current = await getAttemptById(id);
  if (!current) return { ok: false, code: "not_found" };
  const done = await claimAttempt(
    current._id,
    ["paid", "needs_refund", "refunded"],
    {
      feeMinor: input.feeMinor,
      feeCorrected: {
        by: new mongoose.Types.ObjectId(actorId),
        at: new Date(),
        note: input.note,
      },
    },
  );
  return done ? { ok: true, attempt: done } : { ok: false, code: "no_fee" };
}
