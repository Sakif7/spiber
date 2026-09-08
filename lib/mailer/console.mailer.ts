import type { Mailer } from "./types";
import { logger } from "@/lib/log";

/** Dev/default transport: records the email and prints it in non-prod. */
export const consoleMailer: Mailer = {
  async send(mail) {
    logger.info("mailer:console send", { to: mail.to, subject: mail.subject });
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `\n──────── EMAIL (console transport) ────────\n` +
          `To:      ${mail.to}\n` +
          (mail.cc ? `Cc:      ${[mail.cc].flat().join(", ")}\n` : "") +
          (mail.replyTo ? `Reply-To: ${mail.replyTo}\n` : "") +
          (mail.attachments?.length
            ? `Files:   ${mail.attachments.map((a) => a.filename).join(", ")}\n`
            : "") +
          `Subject: ${mail.subject}\n\n` +
          `${mail.text ?? mail.html}\n` +
          `───────────────────────────────────────────\n`,
      );
    }
  },
};
