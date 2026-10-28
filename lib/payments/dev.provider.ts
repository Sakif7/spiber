import type {
  CheckResult,
  PaymentProvider,
  StartInput,
  StartResult,
} from "./types";
import { connectToDatabase } from "@/lib/db/connect";
import { DevPayment } from "@/lib/models/dev-payment";
import { makeId } from "@/lib/ids";

/**
 * A sandbox gateway that behaves the way PayStation does, without the network.
 *
 * `start` records the invoice and points the customer at a local page that
 * plays PayStation's checkout; that page marks it paid (or not), sends an
 * unsigned success-only notification to our webhook, and sends the browser
 * back with `?status=Successful|Failed|Canceled&invoice_number=…&trx_id=…`.
 * `check` reads the ledger the way PayStation's status lookup does, and
 * reports a decline or a cancel as still "pending" — exactly what the real
 * sandbox did on 2026-10-28. So everything proven here is the PayStation path.
 *
 * It refuses to run in production (see lib/payments/index.ts).
 */
export const devProvider: PaymentProvider = {
  name: "dev",
  online: true,
  mode: "dev",

  async start(input: StartInput): Promise<StartResult> {
    await connectToDatabase();
    try {
      await DevPayment.create({
        invoiceNumber: input.invoiceNumber,
        amountMinor: input.amountMinor,
        callbackUrl: input.callbackUrl,
        reference: input.reference,
      });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) {
        return { ok: false, reason: "duplicate_invoice" };
      }
      throw e;
    }
    return {
      ok: true,
      paymentUrl: `/payments/sandbox?invoice=${encodeURIComponent(input.invoiceNumber)}`,
    };
  },

  async check(invoiceNumber: string): Promise<CheckResult> {
    await connectToDatabase();
    const p = await DevPayment.findOne({ invoiceNumber }).lean().exec();
    if (!p) return { state: "unknown", amountMinor: null, raw: null };
    return {
      state: p.state === "paid" ? "paid" : "pending",
      amountMinor:
        p.state === "paid" ? (p.paidMinor ?? p.amountMinor) : p.amountMinor,
      trxId: p.trxId ?? undefined,
      method: p.state === "paid" ? "DEV" : undefined,
      raw: { invoiceNumber, state: p.state },
    };
  },

  async readNotification(req: Request): Promise<string | null> {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      const inv = body?.invoice_number;
      return typeof inv === "string" && inv.trim() ? inv.trim() : null;
    } catch {
      return null;
    }
  },
};

/**
 * Settle a sandbox invoice the way a customer at PayStation would. Returns the
 * URL the browser is sent back to. Used by the sandbox page and by tests.
 */
export async function completeDevPayment(
  invoiceNumber: string,
  outcome: "paid" | "failed" | "cancelled",
  opts: { paidMinor?: number } = {},
): Promise<{ callbackUrl: string; trxId: string | null } | null> {
  await connectToDatabase();
  const p = await DevPayment.findOne({ invoiceNumber }).exec();
  if (!p) return null;
  let trxId: string | null = null;
  if (outcome === "paid" && p.state !== "paid") {
    trxId = makeId("DEVTRX");
    p.state = "paid";
    p.trxId = trxId;
    p.paidMinor = opts.paidMinor ?? p.amountMinor;
    await p.save();
  }
  const status =
    outcome === "paid"
      ? "Successful"
      : outcome === "failed"
        ? "Failed"
        : "Canceled";
  const q = new URLSearchParams({
    status,
    invoice_number: invoiceNumber,
    trx_id: trxId ?? p.trxId ?? "",
  });
  return { callbackUrl: `${p.callbackUrl}?${q.toString()}`, trxId };
}

/** What the sandbox page shows. */
export async function devPaymentView(invoiceNumber: string) {
  await connectToDatabase();
  const p = await DevPayment.findOne({ invoiceNumber }).lean().exec();
  return p
    ? {
        invoiceNumber: p.invoiceNumber,
        amountMinor: p.amountMinor,
        state: p.state,
        reference: p.reference ?? null,
        callbackUrl: p.callbackUrl,
      }
    : null;
}
