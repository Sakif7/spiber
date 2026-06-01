import type { Mailer } from "./types";
import { consoleMailer } from "./console.mailer";
import { logger } from "@/lib/log";

export type { Mail, Mailer } from "./types";

let cached: Mailer | null = null;

/**
 * Resolve the active mail transport from EMAIL_PROVIDER. Only `console` is
 * implemented in Phase 0; `resend`/`smtp` are drop-in points that currently
 * fall back to console so flows never crash for lack of an email account.
 */
export function getMailer(): Mailer {
  if (cached) return cached;
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  switch (provider) {
    case "console":
      cached = consoleMailer;
      break;
    default:
      logger.warn(
        `EMAIL_PROVIDER="${provider}" not implemented yet; falling back to console`,
      );
      cached = consoleMailer;
  }
  return cached;
}
