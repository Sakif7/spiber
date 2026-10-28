import type { PaymentProvider } from "./types";
import { manualProvider } from "./manual.provider";
import { devProvider } from "./dev.provider";
import {
  createPaystationProvider,
  paystationConfig,
} from "./paystation.provider";

export type {
  PaymentProvider,
  PaymentCustomer,
  StartInput,
  StartResult,
  CheckResult,
  PaymentState,
} from "./types";

let cached: PaymentProvider | null = null;

/** Every provider that actually exists. A name not in here is a misconfiguration. */
const REGISTRY: Record<string, () => PaymentProvider> = {
  manual: () => manualProvider,
  dev: () => devProvider,
  // Reads its credentials when chosen, and throws if they are missing or the
  // sandbox is pointed at from production.
  paystation: () => createPaystationProvider(paystationConfig()),
};

/**
 * Resolve the active payment provider from PAYMENT_PROVIDER.
 *
 * An unknown name throws rather than falling back to manual. Falling back
 * looks harmless, but it would accept orders through a checkout that charges
 * nobody, and it does so silently: you would find out from your bank balance.
 * A misconfigured gateway must break loudly instead.
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const name = (process.env.PAYMENT_PROVIDER ?? "manual").trim() || "manual";
  const make = REGISTRY[name];
  if (!make) {
    throw new Error(
      `PAYMENT_PROVIDER="${name}" is not implemented. ` +
        `Available: ${Object.keys(REGISTRY).join(", ")}. ` +
        `Use "manual" for offline payment until the gateway is built.`,
    );
  }
  if (name === "dev" && process.env.NODE_ENV === "production") {
    throw new Error(
      'PAYMENT_PROVIDER="dev" is the sandbox gateway and refuses to run in production.',
    );
  }
  cached = make();
  return cached;
}

/**
 * The configured provider, or why it cannot be used — for screens that must
 * render either way (checkout, Company › Payments).
 */
export function paymentProviderStatus():
  | { ok: true; provider: PaymentProvider }
  | { ok: false; error: string } {
  try {
    return { ok: true, provider: getPaymentProvider() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Test-only: drop the memoized provider so a test can change the env var. */
export function resetPaymentProviderCache(): void {
  cached = null;
}
