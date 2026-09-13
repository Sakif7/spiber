import { httpProvisioner } from "./http.provisioner";
import { memoryProvisioner } from "./memory.provisioner";
import { MailProvisionError, type MailProvisioner } from "./types";

export { MailProvisionError } from "./types";
export type { MailAccount, MailProvisioner, ProvisionError } from "./types";

/**
 * Resolve the provisioner from MAIL_PROVISIONER:
 *   - `http`    the sidecar next to docker-mailserver (production).
 *   - `memory`  in-process, forgets on restart (tests, `dev:sandbox`).
 *   - unset     `memory` outside production; in production it is a
 *               configuration error, surfaced when a mailbox is first needed
 *               (creating an employee) — never a silent "simulated" account
 *               on the live site.
 * Any other value throws, like the payments seam.
 */
export function getMailProvisioner(): MailProvisioner {
  const name = process.env.MAIL_PROVISIONER?.trim();
  if (!name) {
    if (process.env.NODE_ENV === "production") {
      throw new MailProvisionError(
        "not_configured",
        "MAIL_PROVISIONER is not set (expected `http` in production)",
      );
    }
    return memoryProvisioner;
  }
  switch (name) {
    case "http":
      return httpProvisioner;
    case "memory":
      return memoryProvisioner;
    default:
      throw new Error(`Unknown MAIL_PROVISIONER "${name}" (http | memory)`);
  }
}
