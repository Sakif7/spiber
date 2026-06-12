import { logger } from "@/lib/log";
import { manualTravelProvider } from "./manual.provider";
import type { TravelProvider } from "./types";
import type { TravelRequestType } from "@/lib/schemas/travel-request";

const ENV_BY_TYPE: Record<TravelRequestType, string> = {
  air: "FLIGHT_PROVIDER",
  hotel: "HOTEL_PROVIDER",
  visa: "VISA_PROVIDER",
  transfer: "TRANSFER_PROVIDER",
};

/**
 * Resolve the travel provider for a request type from env (default "manual").
 * Any not-yet-implemented provider name falls back to manual with a warning —
 * exactly the `getPaymentProvider` pattern, so a flow never breaks on a missing
 * integration.
 */
export function getTravelProvider(type: TravelRequestType): TravelProvider {
  const envKey = ENV_BY_TYPE[type];
  const name = process.env[envKey]?.trim() || "manual";
  switch (name) {
    case "manual":
      return manualTravelProvider;
    default:
      logger.warn(`${envKey}="${name}" not implemented yet; using manual`);
      return manualTravelProvider;
  }
}

export type { TravelProvider } from "./types";
