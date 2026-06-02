import type { PaymentProvider } from "./types";
import { manualProvider } from "./manual.provider";
import { logger } from "@/lib/log";

export type { PaymentProvider, InitiateResult } from "./types";

let cached: PaymentProvider | null = null;

/**
 * Resolve the active payment provider from PAYMENT_PROVIDER. Only `manual` is
 * implemented in Phase 1; gateway names fall back to manual with a warning so
 * checkout never breaks for lack of a configured gateway.
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const name = process.env.PAYMENT_PROVIDER ?? "manual";
  switch (name) {
    case "manual":
      cached = manualProvider;
      break;
    default:
      logger.warn(
        `PAYMENT_PROVIDER="${name}" not implemented yet; using manual`,
      );
      cached = manualProvider;
  }
  return cached;
}
