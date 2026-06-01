export type Mail = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/** Pluggable mail transport. Default = console (dev); Resend/SMTP via env. */
export interface Mailer {
  send(mail: Mail): Promise<void>;
}
