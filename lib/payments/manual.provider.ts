import type { PaymentProvider } from "./types";

/**
 * Offline/manual payment: no money moves online. The order is created unpaid
 * and an admin marks it paid once the bank transfer, cash or invoice
 * settlement actually lands.
 */
export const manualProvider: PaymentProvider = {
  name: "manual",
  online: false,
  mode: "offline",
};
