import type { DeliveryType } from "@/lib/schemas/systems";
import type { FulfillmentProvider } from "./types";
import { assetProvider } from "./asset.provider";
import { licenseProvider } from "./license.provider";
import { externalManualProvider } from "./external/manual.provider";
import { logger } from "@/lib/log";

export type { FulfillmentProvider, FulfillmentResult } from "./types";

/**
 * Resolve the fulfillment provider for a delivery type. For `external`, the
 * concrete provider is selected by SYSTEMS_PROVISION_PROVIDER (only `manual` is
 * implemented now; an automated `zenhcare` provider drops in here later).
 */
export function getFulfillmentProvider(
  deliveryType: DeliveryType,
): FulfillmentProvider {
  switch (deliveryType) {
    case "asset":
      return assetProvider;
    case "license":
      return licenseProvider;
    case "external": {
      const name = process.env.SYSTEMS_PROVISION_PROVIDER ?? "manual";
      if (name !== "manual") {
        logger.warn(
          `SYSTEMS_PROVISION_PROVIDER="${name}" not implemented yet; using manual`,
        );
      }
      return externalManualProvider;
    }
  }
}
