import type { IOrder } from "@/lib/models/order";
import type { PaymentProviderName } from "@/lib/schemas/order";

export type InitiateResult = { redirectUrl?: string } | null;

/**
 * Pluggable payment provider. The default manual/offline provider creates the
 * order as `pending` and returns null (an admin later marks it paid). Online
 * gateways (SSLCommerz/AamarPay/Stripe) implement `initiate` (redirect) and
 * `verifyWebhook` (server-side confirmation) — drop-in via PAYMENT_PROVIDER.
 */
export interface PaymentProvider {
  name: PaymentProviderName;
  initiate(order: IOrder): Promise<InitiateResult>;
  verifyWebhook?(
    req: Request,
  ): Promise<{
    orderId: string;
    paid: boolean;
    txnId?: string;
    raw?: unknown;
  } | null>;
}
