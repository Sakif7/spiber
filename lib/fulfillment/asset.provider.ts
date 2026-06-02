import type { FulfillmentProvider } from "./types";

/**
 * Asset delivery: nothing is generated. Access to the downloadable asset is
 * granted implicitly — the secure route (/api/media/software/[productId])
 * checks that the user owns a paid purchase. Idempotent by construction.
 */
export const assetProvider: FulfillmentProvider = {
  type: "asset",
  async fulfill() {
    return {};
  },
};
