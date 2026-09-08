import nodemailer, { type Transporter } from "nodemailer";
import type { Mail, Mailer } from "./types";
import { logger } from "@/lib/log";

/**
 * SMTP transport (e.g. Hostinger business email). Configure via env:
 *   EMAIL_PROVIDER=smtp
 *   SMTP_HOST=smtp.hostinger.com
 *   SMTP_PORT=465            # 465 (SSL) or 587 (STARTTLS)
 *   SMTP_USER=noreply@spibermed.com
 *   SMTP_PASS=••••••
 *   EMAIL_FROM="Spiber Med <noreply@spibermed.com>"
 *
 * For inbox delivery, add SPF + DKIM DNS records for the sending domain.
 */
let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (transport) return transport;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error(
      "EMAIL_PROVIDER=smtp requires SMTP_HOST, SMTP_USER and SMTP_PASS",
    );
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  transport = nodemailer.createTransport({
    host,
    port,
    // Default secure on for the implicit-TLS port 465, STARTTLS otherwise.
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : port === 465,
    auth: { user, pass },
  });
  return transport;
}

export const smtpMailer: Mailer = {
  async send(mail: Mail): Promise<void> {
    const from =
      process.env.EMAIL_FROM ??
      process.env.SMTP_USER ??
      "noreply@spibermed.com";
    await getTransport().sendMail({
      from,
      to: mail.to,
      cc: mail.cc,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments,
    });
    logger.info("email sent (smtp)", { to: mail.to, subject: mail.subject });
  },
};
