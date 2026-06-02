import type { Mailer } from "./types";
import { consoleMailer } from "./console.mailer";
import { smtpMailer } from "./smtp.mailer";
import { logger } from "@/lib/log";

export type { Mail, Mailer } from "./types";

let cached: Mailer | null = null;

/**
 * Resolve the active mail transport from EMAIL_PROVIDER:
 *   - `console` (default): logs mail to the server console (dev).
 *   - `smtp`: real delivery via SMTP (e.g. Hostinger business email).
 * Unknown providers fall back to console so flows never crash for lack of an
 * email account.
 */
export function getMailer(): Mailer {
  if (cached) return cached;
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  switch (provider) {
    case "console":
      cached = consoleMailer;
      break;
    case "smtp":
      cached = smtpMailer;
      break;
    default:
      logger.warn(
        `EMAIL_PROVIDER="${provider}" not implemented yet; falling back to console`,
      );
      cached = consoleMailer;
  }
  return cached;
}
