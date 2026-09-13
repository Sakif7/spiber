import { memoryTransport } from "./memory.transport";
import { smtpTransport } from "./smtp.transport";
import { MailTransportError, type MailTransport } from "./types";

export { composeMessage } from "./compose";
export { MailTransportError } from "./types";
export type * from "./types";

/**
 * Resolve the transport from MAIL_TRANSPORT:
 *   - `smtp`    the company mail server via the master user (production).
 *   - `memory`  an in-process outbox (tests, `dev:sandbox`).
 *   - unset     `memory` outside production; in production a configuration
 *               error surfaced on the first send.
 * Any other value throws. (This is separate from `EMAIL_PROVIDER`, the
 * app's own notification mailer — that one sends as noreply@, this one sends
 * as a person.)
 */
export function getMailTransport(): MailTransport {
  const name = process.env.MAIL_TRANSPORT?.trim();
  if (!name) {
    if (process.env.NODE_ENV === "production") {
      throw new MailTransportError(
        "not_configured",
        "MAIL_TRANSPORT is not set (expected `smtp` in production)",
      );
    }
    return memoryTransport;
  }
  switch (name) {
    case "smtp":
      return smtpTransport;
    case "memory":
      return memoryTransport;
    default:
      throw new Error(`Unknown MAIL_TRANSPORT "${name}" (smtp | memory)`);
  }
}
