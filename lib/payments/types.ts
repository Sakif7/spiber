import type { IOrder } from "@/lib/models/order";
import type { PaymentProviderName } from "@/lib/schemas/order";

/** Where to send the customer to pay, and how the gateway refers to the attempt. */
export type InitiateResult = {
  redirectUrl: string;
  /** The gateway's reference for this attempt, stored on the order as txnId. */
  reference?: string;
} | null;

/** Where the gateway should send the customer back to. */
export type InitiateContext = {
  /** Paid or not, the customer lands here and we show them the real status. */
  returnUrl: string;
  /** Used when the customer abandons the gateway's own page. */
  cancelUrl: string;
};

/**
 * One verified callback from a gateway, normalized.
 *
 * `eventId` and `amountMinor` are what make the webhook safe: the first is
 * unique per delivery so a replay can be rejected, and the second is checked
 * against the order so a tampered callback cannot settle a large order with a
 * small payment.
 */
export type WebhookEvent = {
  eventId: string;
  /** Our order number, as it was handed to the gateway. */
  orderNumber: string;
  outcome: "paid" | "failed";
  /** What the gateway says it actually took, in poisha. */
  amountMinor: number;
  txnId?: string;
  raw?: unknown;
};

/** A refund attempt against the gateway. */
export type RefundResult =
  | { ok: true; reference?: string }
  | { ok: false; reason: string };

/**
 * Pluggable payment provider.
 *
 * `manual` is the offline arrangement: it takes no money and an admin marks
 * the order paid. An online gateway implements `initiate` (hand the customer
 * over), `verifyWebhook` (confirm server-side, never trusting the browser) and
 * ideally `refund`.
 */
export interface PaymentProvider {
  name: PaymentProviderName;
  /** True when this provider actually collects money during checkout. */
  online: boolean;
  initiate(order: IOrder, ctx: InitiateContext): Promise<InitiateResult>;
  /**
   * Verify a callback and normalize it. MUST return null for anything that
   * fails signature verification, so an unauthenticated POST can never settle
   * an order.
   */
  verifyWebhook?(req: Request): Promise<WebhookEvent | null>;
  /** Return money for an already-paid order. Amount is in poisha. */
  refund?(order: IOrder, amountMinor: number): Promise<RefundResult>;
}
