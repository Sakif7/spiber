import type { TravelProvider } from "./types";

/**
 * Default provider: no live API. The TravelRequest row is the record; an admin
 * works the queue and records the quote/confirmation manually. Returns null
 * (mirrors `lib/payments/manual.provider`).
 */
export const manualTravelProvider: TravelProvider = {
  name: "manual",
  async submit() {
    return null;
  },
};
