import nodemailer from "nodemailer";
import { logger } from "@/lib/log";
import { MailTransportError, type MailTransport } from "./types";

/**
 * Submission to the company mail server as the mailbox itself, authenticated
 * with the master user (`<mailbox>*<master>`), the same credential the read
 * side uses — so a person's own mailbox password is never needed to send.
 *
 *   MAIL_SMTP_HOST / MAIL_SMTP_PORT   mail.spibermed.com / 465 (implicit TLS)
 *   MAIL_MASTER_USER / MAIL_MASTER_PASSWORD
 */
function config() {
  const host = process.env.MAIL_SMTP_HOST?.trim();
  const user = process.env.MAIL_MASTER_USER?.trim();
  const pass = process.env.MAIL_MASTER_PASSWORD;
  if (!host || !user || !pass) {
    throw new MailTransportError(
      "not_configured",
      "MAIL_TRANSPORT=smtp needs MAIL_SMTP_HOST, MAIL_MASTER_USER and MAIL_MASTER_PASSWORD",
    );
  }
  const port = Number(process.env.MAIL_SMTP_PORT || 465);
  return { host, port, user, pass, secure: port === 465 };
}

export const smtpTransport: MailTransport = {
  name: "smtp",
  async deliver(fromAddress, composed) {
    const c = config();
    const transporter = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: { user: `${fromAddress}*${c.user}`, pass: c.pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 60_000,
    });
    try {
      await transporter.sendMail({
        envelope: { from: fromAddress, to: composed.envelopeTo },
        raw: composed.raw,
      });
    } catch (e) {
      const err = e as {
        code?: string;
        responseCode?: number;
        message?: string;
      };
      logger.error("smtp deliver failed", {
        from: fromAddress,
        code: err.code,
        responseCode: err.responseCode,
        error: err.message,
      });
      if (err.code === "EAUTH") {
        throw new MailTransportError("auth_failed", err.message);
      }
      if (err.responseCode && err.responseCode >= 500) {
        throw new MailTransportError("rejected", err.message);
      }
      throw new MailTransportError("unavailable", err.message);
    } finally {
      transporter.close();
    }
  },
};
