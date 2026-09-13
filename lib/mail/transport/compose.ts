import MailComposer from "nodemailer/lib/mail-composer/index.js";
import type { ComposedMessage, OutgoingMessage } from "./types";

/**
 * Build the RFC 822 message once, with nodemailer's own composer — the same
 * code path that would serialise a normal `sendMail`, so every client reads
 * it the same way whether it arrived by SMTP or by the Sent-folder copy.
 */
const fmt = (a: { name: string | null; address: string }) =>
  a.name ? { name: a.name, address: a.address } : a.address;

export async function composeMessage(
  msg: OutgoingMessage,
  domain: string,
): Promise<ComposedMessage> {
  const messageId = `<${cryptoId()}@${domain}>`;
  const composer = new MailComposer({
    from: fmt(msg.from),
    to: msg.to.map(fmt),
    cc: msg.cc.map(fmt),
    bcc: msg.bcc.map(fmt),
    replyTo: msg.replyTo ? fmt(msg.replyTo) : undefined,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    messageId,
    inReplyTo: msg.inReplyTo ?? undefined,
    references: msg.references?.length ? msg.references.join(" ") : undefined,
    attachments: msg.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      content: a.content,
      cid: a.cid,
      contentDisposition: a.cid ? "inline" : "attachment",
    })),
    date: new Date(),
  });
  const raw = await composer.compile().build();
  return {
    messageId,
    raw,
    envelopeTo: [...msg.to, ...msg.cc, ...msg.bcc].map((a) => a.address),
  };
}

function cryptoId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
