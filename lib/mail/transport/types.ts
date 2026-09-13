import type { MailAddress } from "@/lib/mail/store/types";

/**
 * Sending as a mailbox. The message is composed ONCE (an RFC 822 buffer);
 * the transport only delivers it, and the same buffer is appended to the
 * mailbox's Sent folder, so what was sent and what is on file are one thing.
 */
export type OutgoingAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
  /** Inline image, referenced from the HTML as `cid:` */
  cid?: string;
};

export type OutgoingMessage = {
  from: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  replyTo?: MailAddress | null;
  subject: string;
  text: string;
  html: string;
  attachments: OutgoingAttachment[];
  inReplyTo?: string | null;
  references?: string[];
};

export type ComposedMessage = {
  messageId: string;
  raw: Buffer;
  /** Envelope recipients (to + cc + bcc), what the server actually delivers to. */
  envelopeTo: string[];
};

export class MailTransportError extends Error {
  constructor(
    public readonly code:
      | "not_configured"
      | "auth_failed"
      | "rejected"
      | "unavailable",
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "MailTransportError";
  }
}

export interface MailTransport {
  readonly name: string;
  /** Deliver an already-composed message as `fromAddress` (the mailbox). */
  deliver(fromAddress: string, composed: ComposedMessage): Promise<void>;
}
