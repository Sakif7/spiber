import type { MailAdminError } from "@/lib/services/mail-admin.service";

/** HTTP status for a mail-admin failure. */
export function mailAdminStatus(code: MailAdminError): number {
  switch (code) {
    case "exists":
      return 409;
    case "not_found":
      return 404;
    case "provisioner_not_configured":
    case "vault_not_configured":
    case "provision_failed":
      return 503;
    default:
      return 400;
  }
}
