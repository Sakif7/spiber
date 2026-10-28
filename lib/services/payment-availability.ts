import { paymentProviderStatus } from "@/lib/payments";
import { isPaymentPointOn } from "./payment-settings.service";
import type { PaymentPoint } from "@/lib/schemas/payment";

/**
 * Can customers pay online at this door right now: a gateway that takes money
 * is configured AND the super admin has switched the door on.
 *
 * Kept apart from payment.service so the services that payment.service
 * settles into (software, enrollment) can ask without importing it back.
 */
export async function onlinePointAvailable(
  point: PaymentPoint,
): Promise<boolean> {
  const s = paymentProviderStatus();
  if (!s.ok || !s.provider.online || !s.provider.start || !s.provider.check) {
    return false;
  }
  return isPaymentPointOn(point);
}
