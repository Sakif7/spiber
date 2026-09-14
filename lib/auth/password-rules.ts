/**
 * What a password must look like, in one place: the Zod schemas (server and
 * client) and the live checklist in the reset / register forms all read the
 * same rules, so a password the form ticks green is one the API accepts.
 * No imports on purpose — this runs in the browser.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

export type PasswordRule = "length" | "letter" | "number";

export const PASSWORD_RULES: PasswordRule[] = ["length", "letter", "number"];

/** Which rules a candidate password already meets. */
export function passwordChecks(pw: string): Record<PasswordRule, boolean> {
  return {
    length: pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX,
    letter: /\p{L}/u.test(pw),
    number: /\d/.test(pw),
  };
}

export function passwordMeetsRules(pw: string): boolean {
  return Object.values(passwordChecks(pw)).every(Boolean);
}
