import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { completeDevPayment } from "@/lib/payments/dev.provider";

export const dynamic = "force-dynamic";

const completeSchema = z.object({
  invoiceNumber: z.string().trim().min(3).max(80),
  outcome: z.enum(["paid", "failed", "cancelled"]),
  /** A test can make the "customer" pay a different amount. */
  paidMinor: z.number().int().min(0).optional(),
  /** Skip the notification, to prove the sweeper settles without one. */
  notify: z.boolean().optional(),
});

/**
 * Stands in for PayStation's back end: settles the sandbox invoice, sends our
 * webhook the same unsigned, success-only notification PayStation sends, and
 * tells the page where PayStation would send the customer back.
 *
 * Going over HTTP rather than calling the service directly is the point: the
 * notification route, its status codes and the lookup it triggers are the
 * code paths the real gateway takes.
 *
 * Sandbox only, and it refuses to exist in production.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return fail({ code: "not_found" }, 404);
  }
  const parsed = await parseJson(req, completeSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const { invoiceNumber, outcome, paidMinor, notify } = parsed.data;
  const done = await completeDevPayment(invoiceNumber, outcome, { paidMinor });
  if (!done) return fail({ code: "not_found" }, 404);

  let notified: number | null = null;
  if (outcome === "paid" && notify !== false) {
    const origin = new URL(req.url).origin;
    const res = await fetch(`${origin}/api/payments/webhook/dev`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        invoice_number: invoiceNumber,
        trx_status: "Success",
        trx_id: done.trxId,
        trx_amount: (paidMinor ?? 0) / 100,
        payment_method: "DEV",
      }),
    }).catch(() => null);
    notified = res?.status ?? null;
  }
  return ok({ callbackUrl: done.callbackUrl, notified });
}
