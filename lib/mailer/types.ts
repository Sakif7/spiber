export type MailAttachment = {
  filename: string;
  content?: Buffer;
  path?: string;
  /** Set to reference the attachment inline from the HTML via `src="cid:<cid>"`. */
  cid?: string;
  contentType?: string;
};

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
};

/** Pluggable mail transport. Default = console (dev); Resend/SMTP via env. */
export interface Mailer {
  send(mail: Mail): Promise<void>;
}
