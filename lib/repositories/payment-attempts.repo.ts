import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  PaymentAttempt,
  type IPaymentAttempt,
  type IPaymentCheck,
} from "@/lib/models/payment-attempt";
import type { Lean } from "@/lib/models/_shared";
import type {
  PaymentAttemptStatus,
  PaymentIssue,
  PaymentSubjectKind,
} from "@/lib/schemas/payment";

export type LeanAttempt = Lean<IPaymentAttempt>;

/** Keep the check log readable: the newest looks matter, not a week of polling. */
const MAX_CHECKS = 40;

export async function createAttempt(
  data: Partial<IPaymentAttempt>,
): Promise<LeanAttempt> {
  await connectToDatabase();
  const doc = await PaymentAttempt.create(data);
  return doc.toObject() as LeanAttempt;
}

export async function getAttemptByInvoice(
  invoiceNumber: string,
): Promise<LeanAttempt | null> {
  await connectToDatabase();
  return PaymentAttempt.findOne({ invoiceNumber }).lean<LeanAttempt>().exec();
}

export async function getAttemptById(id: string): Promise<LeanAttempt | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectToDatabase();
  return PaymentAttempt.findById(id).lean<LeanAttempt>().exec();
}

export async function attemptsForSubject(
  kind: PaymentSubjectKind,
  id: string,
): Promise<LeanAttempt[]> {
  if (!mongoose.isValidObjectId(id)) return [];
  await connectToDatabase();
  return PaymentAttempt.find({ "subject.kind": kind, "subject.id": id })
    .sort({ createdAt: -1 })
    .lean<LeanAttempt[]>()
    .exec();
}

/** How many tries one pay link has started. */
export async function countAttemptsForRequest(
  requestId: mongoose.Types.ObjectId,
): Promise<number> {
  await connectToDatabase();
  return PaymentAttempt.countDocuments({ requestId }).exec();
}

/** Record one look at the gateway (capped), plus any fields it settled. */
export async function recordCheck(
  id: unknown,
  check: IPaymentCheck,
  set: Record<string, unknown> = {},
): Promise<void> {
  await connectToDatabase();
  await PaymentAttempt.updateOne(
    { _id: id },
    {
      $set: { lastCheckedAt: check.at, ...set },
      $push: { checks: { $each: [check], $slice: -MAX_CHECKS } },
    },
  ).exec();
}

/**
 * Move an attempt on, but only from the states given — the one write that
 * decides which of several racing callers (IPN, return, sweeper, admin)
 * applies a payment. Returns the attempt after the move, or null if someone
 * else moved it first.
 */
export async function claimAttempt(
  id: unknown,
  from: PaymentAttemptStatus[],
  set: Record<string, unknown>,
): Promise<LeanAttempt | null> {
  await connectToDatabase();
  return PaymentAttempt.findOneAndUpdate(
    { _id: id, status: { $in: from } },
    { $set: set },
    { returnDocument: "after" },
  )
    .lean<LeanAttempt>()
    .exec();
}

/** Open attempts the sweeper should look at now. */
export async function dueOpenAttempts(
  now: Date,
  limit = 100,
): Promise<LeanAttempt[]> {
  await connectToDatabase();
  return PaymentAttempt.find({ status: "open", nextCheckAt: { $lte: now } })
    .sort({ nextCheckAt: 1 })
    .limit(limit)
    .lean<LeanAttempt[]>()
    .exec();
}

/**
 * Something paid online was cancelled or refunded. With a reference the money
 * went back already and is recorded as such; without one it waits under
 * Needs refund until someone returns it.
 */
export async function markSubjectPaymentsForRefund(
  kind: PaymentSubjectKind | PaymentSubjectKind[],
  id: string,
  opts: { reference?: string; note?: string; actorId?: string | null } = {},
): Promise<number> {
  await connectToDatabase();
  const now = new Date();
  const ref = opts.reference?.trim();
  const kinds = Array.isArray(kind) ? kind : [kind];
  const res = await PaymentAttempt.updateMany(
    { "subject.kind": { $in: kinds }, "subject.id": id, status: "paid" },
    {
      $set: ref
        ? {
            status: "refunded",
            issue: "cancelled" satisfies PaymentIssue,
            refund: {
              reference: ref,
              note: opts.note,
              at: now,
              by: opts.actorId ?? null,
            },
          }
        : { status: "needs_refund", issue: "cancelled" satisfies PaymentIssue },
    },
  ).exec();
  return res.modifiedCount;
}

export type AttemptListQuery = {
  status?: PaymentAttemptStatus | null;
  kind?: PaymentSubjectKind | null;
  q?: string | null;
  page: number;
  pageSize: number;
};

export async function listAttempts(
  query: AttemptListQuery,
): Promise<{ rows: LeanAttempt[]; total: number }> {
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.kind) filter["subject.kind"] = query.kind;
  const q = query.q?.trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ invoiceNumber: rx }, { "subject.ref": rx }, { trxId: rx }];
  }
  const [rows, total] = await Promise.all([
    PaymentAttempt.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .select({ checks: 0 })
      .lean<LeanAttempt[]>()
      .exec(),
    PaymentAttempt.countDocuments(filter).exec(),
  ]);
  return { rows, total };
}

export async function countAttemptsByStatus(): Promise<
  Partial<Record<PaymentAttemptStatus, number>>
> {
  await connectToDatabase();
  const rows = await PaymentAttempt.aggregate<{ _id: string; n: number }>([
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]).exec();
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

/** The ledger's headline: taken and charged in a window, and what is owed back. */
export async function paymentTotals(
  start: Date,
  end: Date,
): Promise<{
  takenMinor: number;
  feeMinor: number;
  taken: number;
  feeMissing: number;
  owedMinor: number;
  owed: number;
}> {
  await connectToDatabase();
  const [inWindow, owed] = await Promise.all([
    PaymentAttempt.aggregate<{
      taken: number;
      takenMinor: number;
      feeMinor: number;
      feeMissing: number;
    }>([
      {
        $match: {
          status: { $in: ["paid", "needs_refund", "refunded"] },
          paidAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          taken: { $sum: 1 },
          takenMinor: { $sum: { $ifNull: ["$paidMinor", "$amountMinor"] } },
          feeMinor: { $sum: { $ifNull: ["$feeMinor", 0] } },
          feeMissing: {
            $sum: {
              $cond: [{ $eq: [{ $ifNull: ["$feeMinor", null] }, null] }, 1, 0],
            },
          },
        },
      },
    ]).exec(),
    PaymentAttempt.aggregate<{ owed: number; owedMinor: number }>([
      { $match: { status: "needs_refund" } },
      {
        $group: {
          _id: null,
          owed: { $sum: 1 },
          owedMinor: { $sum: { $ifNull: ["$paidMinor", "$amountMinor"] } },
        },
      },
    ]).exec(),
  ]);
  return {
    taken: inWindow[0]?.taken ?? 0,
    takenMinor: inWindow[0]?.takenMinor ?? 0,
    feeMinor: inWindow[0]?.feeMinor ?? 0,
    feeMissing: inWindow[0]?.feeMissing ?? 0,
    owed: owed[0]?.owed ?? 0,
    owedMinor: owed[0]?.owedMinor ?? 0,
  };
}

/**
 * Money the gateway took in a window — settled, refunded or waiting to go
 * back. The fee on every one of them is a real cost: PayStation keeps it
 * even when the payment is returned.
 */
export async function takenBetween(
  start: Date,
  end: Date,
): Promise<LeanAttempt[]> {
  await connectToDatabase();
  return PaymentAttempt.find({
    status: { $in: ["paid", "needs_refund", "refunded"] },
    paidAt: { $gte: start, $lt: end },
  })
    .select({ checks: 0 })
    .lean<LeanAttempt[]>()
    .exec();
}
