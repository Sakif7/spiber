import type { ITravelRequest } from "@/lib/models/travelRequest";

export type TravelSubmitResult = { ok: boolean; ref?: string } | null;

/**
 * Pluggable travel fulfilment seam (flights/hotels/visa/transfers). The MANUAL
 * default just records the request (the DB row IS the record) and returns null —
 * an admin fulfils it and records the quote/confirmation. A real API provider
 * (e.g. Amadeus) drops in via env without touching the request service. Mirrors
 * `lib/payments`. Must never throw in a way that fails the patient's request.
 */
export interface TravelProvider {
  readonly name: string;
  submit(req: ITravelRequest): Promise<TravelSubmitResult>;
}
