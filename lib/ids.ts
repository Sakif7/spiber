import { randomInt } from "node:crypto";

/** Crypto-strong, uniformly-distributed base36 suffix of fixed length. */
function randomSuffix(chars: number): string {
  // 36**chars stays a safe integer for chars <= 10 (36**10 < 2**53).
  return randomInt(36 ** chars)
    .toString(36)
    .toUpperCase()
    .padStart(chars, "0");
}

/**
 * Human-readable reference ids: a base36-encoded timestamp + a crypto-random
 * suffix, prefixed per entity (e.g. `SPM-SW-LZ4K-0Q2X9`). Uniqueness is also
 * guarded by unique DB indexes where it matters; the wide random suffix makes
 * an intra-millisecond collision against that index effectively impossible
 * (default 5 base36 chars ≈ 60M combinations per millisecond).
 */
export function makeId(prefix: string, randomChars = 5): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}-${ts}-${randomSuffix(randomChars)}`;
}

/** SPM-SW-… — a software purchase reference. */
export const softwarePurchaseNumber = (): string => makeId("SPM-SW");
/** SPM-LIC-… — a software license key (wider random space). */
export const licenseKey = (): string => makeId("SPM-LIC", 8);
/** SPM-INQ-… — a lead/inquiry reference. */
export const inquiryNumber = (): string => makeId("SPM-INQ");
/** SPM-MSG-… — a contact-form message reference. */
export const contactMessageNumber = (): string => makeId("SPM-MSG");
/** SPM-TASK-… — a provisioning-task reference. */
export const provisioningTaskRef = (): string => makeId("SPM-TASK");
/** SPM-RFQ-… — an instruments quotation (request-for-quote) reference. */
export const quotationNumber = (): string => makeId("SPM-RFQ");
/** SPM-APP-… — a job-application reference. */
export const jobApplicationNumber = (): string => makeId("SPM-APP");
/** SPM-CASE-… — a medical tourism case reference. */
export const medicalCaseNumber = (): string => makeId("SPM-CASE");
/** SPM-APT-… — a doctor/teleconsultation appointment reference. */
export const appointmentNumber = (): string => makeId("SPM-APT");
/** SPM-TRV-… — a travel (air/hotel/visa/transfer) request reference. */
export const travelRequestNumber = (): string => makeId("SPM-TRV");
/** SPM-PTR-… — a "Partner With Us" application reference. */
export const partnerApplicationNumber = (): string => makeId("SPM-PTR");
/** SPM-PRQ-… — a "Request a product" sourcing-request reference. */
export const productRequestNumber = (): string => makeId("SPM-PRQ");
/** SPM-SEL-… — a "Become a seller" onboarding-application reference. */
export const sellerApplicationNumber = (): string => makeId("SPM-SEL");
/** SPM-PAYOUT-… — a seller payout reference. */
export const sellerPayoutNumber = (): string => makeId("SPM-PAYOUT");
/** VAR-… — a stable product-variant id (referenced by cart/order/inventory). */
export const variantId = (): string => makeId("VAR", 6);
/** SPM-CHAT-… — a chatbot conversation reference. */
export const chatConversationRef = (): string => makeId("SPM-CHAT");
/** SPM-LEAD-… — a chatbot-captured lead reference. */
export const chatLeadNumber = (): string => makeId("SPM-LEAD");
