import type { ComposedMessage, MailTransport } from "./types";

/**
 * Sandbox/test delivery: nothing leaves the process. The outbox keeps what
 * would have gone out so a test can read it back; the Sent-folder copy is
 * appended by the service the same way as for real delivery.
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
  },
  _outbox: () => outbox(),
  _reset() {
    globalThis.__mailOutbox = [];
  },
};
