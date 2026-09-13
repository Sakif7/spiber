import { DEFAULT_MAIL_DOMAIN } from "./address";

/**
 * Where the company mail lives. Everything comes from env so the sandbox,
 * the docker dev DB and production can point at different servers without a
 * code change — and so nothing here ever names a real host by default except
 * the domain itself.
 *
 *   MAIL_DOMAIN               spibermed.com
 *   MAIL_IMAP_HOST / _PORT    mail.spibermed.com / 993   (read side, session 2)
 *   MAIL_SMTP_HOST / _PORT    mail.spibermed.com / 465   (send side, session 3)
 *   MAIL_MASTER_USER / _PASSWORD   the Dovecot master user the app opens
 *                                  every mailbox with (never per-employee)
 */
export function mailDomain(): string {
  return (process.env.MAIL_DOMAIN?.trim() || DEFAULT_MAIL_DOMAIN).toLowerCase();
}

/** Shown on the employee page so a phone can be set up without guessing. */
export function mailClientSettings(): {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
} {
  const fallback = `mail.${mailDomain()}`;
  return {
    imapHost: process.env.MAIL_IMAP_HOST?.trim() || fallback,
    imapPort: Number(process.env.MAIL_IMAP_PORT || 993),
    smtpHost: process.env.MAIL_SMTP_HOST?.trim() || fallback,
    smtpPort: Number(process.env.MAIL_SMTP_PORT || 465),
  };
}
