import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { connectToDatabase } from "@/lib/db/connect";
import {
  PaymentRequest,
  type IPaymentRequest,
} from "@/lib/models/payment-request";
import type { Lean } from "@/lib/models/_shared";
import type { PaymentSubjectKind } from "@/lib/schemas/payment";

export type LeanRequest = Lean<IPaymentRequest>;

/** 32 random bytes: a link cannot be guessed, only handed over. */
export const newRequestToken = (): string =>
  randomBytes(32).toString("base64url");

export async function createRequest(
  data: Omit<
    Partial<IPaymentRequest>,
    "token" | "status" | "createdAt" | "updatedAt"
  >,
): Promise<LeanRequest> {
  await connectToDatabase();
  const doc = await PaymentRequest.create({
    ...data,
    token: newRequestToken(),
    status: "open",
  });
  return doc.toObject() as LeanRequest;
}

export async function getRequestByToken(
  token: string,
): Promise<LeanRequest | null> {
  // base64url of 32 bytes is 43 characters; anything else is not ours.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  await connectToDatabase();
  return PaymentRequest.findOne({ token }).lean<LeanRequest>().exec();
}

export async function getRequestById(id: unknown): Promise<LeanRequest | null> {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  await connectToDatabase();
  return PaymentRequest.findById(id).lean<LeanRequest>().exec();
}

/** The link that can still be paid for one thing, if there is one. */
export async function openRequestFor(
  kind: PaymentSubjectKind,
  id: string,
): Promise<LeanRequest | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectToDatabase();
  return PaymentRequest.findOne({
    "subject.kind": kind,
    "subject.id": id,
    status: "open",
  })
    .lean<LeanRequest>()
    .exec();
}

/** Every link made for one thing, newest first. */
export async function requestsFor(
  kind: PaymentSubjectKind,
  id: string,
): Promise<LeanRequest[]> {
  if (!mongoose.isValidObjectId(id)) return [];
  await connectToDatabase();
  return PaymentRequest.find({ "subject.kind": kind, "subject.id": id })
    .sort({ createdAt: -1 })
    .lean<LeanRequest[]>()
    .exec();
}

/** Close a link as paid — only an open one, so it is closed exactly once. */
export async function markRequestPaid(
  id: unknown,
  attemptId: unknown,
  at: Date,
): Promise<boolean> {
  await connectToDatabase();
  const res = await PaymentRequest.updateOne(
    { _id: id, status: "open" },
    { $set: { status: "paid", paidAt: at, attemptId } },
  ).exec();
  return res.modifiedCount === 1;
}

/** Withdraw whatever link is still open for one thing. */
export async function cancelOpenRequests(
  kind: PaymentSubjectKind,
  id: string,
  reason: string,
): Promise<number> {
  if (!mongoose.isValidObjectId(id)) return 0;
  await connectToDatabase();
  const res = await PaymentRequest.updateMany(
    { "subject.kind": kind, "subject.id": id, status: "open" },
    {
      $set: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    },
  ).exec();
  return res.modifiedCount;
}

/** Where the gateway sends the payer's receipt. */
export async function updateRequestCustomerEmail(
  id: unknown,
  email: string,
): Promise<void> {
  await connectToDatabase();
  await PaymentRequest.updateOne(
    { _id: id },
    { $set: { "customer.email": email } },
  ).exec();
}

/** Note one time the link went out by email. */
export async function recordRequestSent(
  id: unknown,
  email: string,
  by: string | null,
): Promise<void> {
  await connectToDatabase();
  await PaymentRequest.updateOne(
    { _id: id },
    { $push: { sentTo: { email, at: new Date(), by } } },
  ).exec();
}
