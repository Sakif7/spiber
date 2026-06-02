import type { PaymentProvider } from "./types";

/** Offline/manual payment: order stays `pending` until an admin marks it paid. */
export const manualProvider: PaymentProvider = {
  name: "manual",
  async initiate() {
    return null;
  },
};
