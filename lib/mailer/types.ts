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
  /** Copied in — used to keep the sales inbox on record for a sent proposal. */
  cc?: string | string[];
  /**
   * Where replies should go. The From address is a fixed no-reply sender, so
   * without this a client's reply to a quotation would be lost.
   */
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
};

/** Pluggable mail transport. Default = console (dev); Resend/SMTP via env. */
export interface Mailer {
  send(mail: Mail): Promise<void>;
}
