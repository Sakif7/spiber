import { memoryMailStore } from "@/lib/mail/store/memory.store";
import type { ComposedMessage, MailTransport } from "./types";

/**
 * Sandbox/test delivery: nothing leaves the process. The outbox keeps what
 * would have gone out so a test can read it back; the Sent-folder copy is
 * appended by the service the same way as for real delivery. A recipient
 * that is a mailbox the memory store already holds gets the message in its
 * Inbox, unread — so the sandbox can show mail arriving and the bell ringing.
 */
declare global {
  var __mailOutbox: { from: string; composed: ComposedMessage }[] | undefined;
}

const outbox = () => (globalThis.__mailOutbox ??= []);

export const memoryTransport: MailTransport & {
  _outbox(): { from: string; composed: ComposedMessage }[];
  _reset(): void;
} = {
  name: "memory",
  async deliver(fromAddress, composed) {
    outbox().push({ from: fromAddress, composed });
    for (const rcpt of composed.envelopeTo) {
      if (memoryMailStore._has(rcpt.toLowerCase())) {
        await memoryMailStore.append(
          rcpt.toLowerCase(),
          "INBOX",
          composed.raw,
          [],
        );
      }
    }
  },
  _outbox: () => outbox(),
  _reset() {
    globalThis.__mailOutbox = [];
  },
};
