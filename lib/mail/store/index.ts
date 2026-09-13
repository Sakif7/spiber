import { imapStore } from "./imap.store";
import { memoryMailStore } from "./memory.store";
import { MailStoreError, type MailStore } from "./types";

export { MailStoreError } from "./types";
export type * from "./types";

/**
 * Resolve the mail store from MAIL_STORE:
 *   - `imap`    the company mail server via the master user (production).
 *   - `memory`  fixtures in-process (tests, `dev:sandbox`).
 *   - unset     `memory` outside production; in production a configuration
 *               error surfaced when a mailbox is first opened.
 * Any other value throws.
 */
export function getMailStore(): MailStore {
  const name = process.env.MAIL_STORE?.trim();
  if (!name) {
    if (process.env.NODE_ENV === "production") {
      throw new MailStoreError(
        "not_configured",
        "MAIL_STORE is not set (expected `imap` in production)",
      );
    }
    return memoryMailStore;
  }
  switch (name) {
    case "imap":
      return imapStore;
    case "memory":
      return memoryMailStore;
    default:
      throw new Error(`Unknown MAIL_STORE "${name}" (imap | memory)`);
  }
}
