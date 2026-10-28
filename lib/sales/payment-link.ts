import type { ISalesOrder } from "@/lib/models/salesOrder";
import type { IPaymentRequest } from "@/lib/models/payment-request";
import type { PaymentLinkBasis } from "@/lib/schemas/payment";

/**
 * What a Sales invoice's pay link asks for. Plain arithmetic on the order, no
 * database: the link service, the settlement and the order page all use it.
 */

/** What a Sales invoice's link asks for, worked out from the order as it is. */
export type SalesLinkAmount = {
  totalMinor: number;
  /** AIT (and VDS) left out of the link: what is on record, or 0 on a full link. */
  withheldMinor: number;
  /** The total less what is left out: what the link is for. */
  dueMinor: number;
  /** That, in whole taka: what the link asks for. */
  amountMinor: number;
  /** Poisha dropped (0 to −99). */
  roundingMinor: number;
};

/** AIT + VDS on record: the invoice's expectation, or the client's slip. */
export function withholdingOnRecord(
  order: Pick<ISalesOrder, "withholding">,
): number {
  const w = order.withholding;
  return Math.max(0, (w?.aitMinor ?? 0) + (w?.vdsMinor ?? 0));
}

/**
 * The invoice says AIT is "deductible at source and NOT included in the total
 * above", so a client who deducts pays the total less what they withhold; one
 * who does not pays it all. Which, is chosen on each link (owner, 2026-10-28):
 * `full` asks for the whole total, `less_withholding` for the total less the
 * AIT + VDS on record.
 */
export function salesLinkAmount(
  order: Pick<ISalesOrder, "totalMinor" | "withholding">,
  basis: PaymentLinkBasis,
): SalesLinkAmount {
  const withheldMinor =
    basis === "full"
      ? 0
      : Math.min(order.totalMinor, withholdingOnRecord(order));
  const dueMinor = Math.max(0, order.totalMinor - withheldMinor);
  const amountMinor = dueMinor - (dueMinor % 100);
  return {
    totalMinor: order.totalMinor,
    withheldMinor,
    dueMinor,
    amountMinor,
    roundingMinor: amountMinor - dueMinor,
  };
}

/** A link's basis; one from before the choice existed took the withholding off. */
export function linkBasisOf(
  link: Pick<IPaymentRequest, "basis" | "withheldMinor">,
): PaymentLinkBasis {
  return (
    link.basis ?? ((link.withheldMinor ?? 0) > 0 ? "less_withholding" : "full")
  );
}
