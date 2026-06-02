/**
 * Human-readable reference ids: a base36-encoded timestamp + a random suffix,
 * prefixed per entity (e.g. `SPM-SW-LZ4K-0Q2`). Not cryptographically secure —
 * uniqueness is also guarded by unique DB indexes where it matters. Mirrors the
 * pattern used by orders/enrollments; centralized here for new entities.
 */
export function makeId(prefix: string, randomDigits = 3): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 36 ** randomDigits)
    .toString(36)
    .toUpperCase()
    .padStart(randomDigits, "0");
  return `${prefix}-${ts}-${rand}`;
}

/** SPM-SW-… — a software purchase reference. */
export const softwarePurchaseNumber = (): string => makeId("SPM-SW");
/** SPM-LIC-… — a software license key (wider random space). */
export const licenseKey = (): string => makeId("SPM-LIC", 4);
/** SPM-INQ-… — a lead/inquiry reference. */
export const inquiryNumber = (): string => makeId("SPM-INQ");
/** SPM-TASK-… — a provisioning-task reference. */
export const provisioningTaskRef = (): string => makeId("SPM-TASK");
