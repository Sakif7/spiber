import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  InitiateContext,
  PaymentProvider,
  RefundResult,
  WebhookEvent,
} from "./types";
import type { IOrder } from "@/lib/models/order";

/**
 * A sandbox gateway that exercises the real redirect-and-webhook loop without
 * an acquirer.
 *
 * It exists so the online payment path can be built and tested before any
 * merchant account arrives: it redirects to a local page that plays the part
 * of the gateway, and that page posts back a signed callback exactly as a real
 * one would. The signature check here is the same check a real provider does,
 * so wiring a real gateway later replaces this file and nothing else.
 *
 * It refuses to run in production (see lib/payments/index.ts).
 */

/** Signing key for sandbox callbacks. Never used in production. */
function secret(): string {
  return process.env.DEV_PAYMENT_SECRET?.trim() || "spiber-sandbox-key";
}

export function signSandboxPayload(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("hex");
}

/** Constant-time compare, so the sandbox teaches the right habit too. */
function signatureMatches(body: string, given: string): boolean {
  const expected = signSandboxPayload(body);
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const devProvider: PaymentProvider = {
  name: "dev",
  online: true,

  async initiate(order: IOrder, ctx: InitiateContext) {
    const params = new URLSearchParams({
      order: order.orderNumber,
      amount: String(order.totalMinor),
      returnUrl: ctx.returnUrl,
      cancelUrl: ctx.cancelUrl,
    });
    return {
      redirectUrl: `/payments/sandbox?${params.toString()}`,
      reference: `DEV-${order.orderNumber}`,
    };
  },

  async verifyWebhook(req: Request): Promise<WebhookEvent | null> {
    const body = await req.text();
    const given = req.headers.get("x-sandbox-signature") ?? "";
    if (!given || !signatureMatches(body, given)) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }
    const p = parsed as Partial<Record<string, unknown>>;
    const orderNumber = typeof p.orderNumber === "string" ? p.orderNumber : "";
    const eventId = typeof p.eventId === "string" ? p.eventId : "";
    const amountMinor = typeof p.amountMinor === "number" ? p.amountMinor : NaN;
    const outcome = p.outcome === "paid" ? "paid" : "failed";
    if (!orderNumber || !eventId || !Number.isFinite(amountMinor)) return null;

    return {
      eventId,
      orderNumber,
      outcome,
      amountMinor,
      txnId: typeof p.txnId === "string" ? p.txnId : undefined,
      raw: parsed,
    };
  },

  async refund(): Promise<RefundResult> {
    // A real gateway calls its refund API here. The sandbox always succeeds so
    // the surrounding bookkeeping can be tested.
    return { ok: true, reference: `DEV-REFUND-${Date.now()}` };
  },
};
