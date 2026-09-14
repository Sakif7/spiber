import { z } from "zod";
import { fail } from "@/lib/http/respond";
import { getMailStore, MailStoreError } from "@/lib/mail/store";
import { forgetMailFeed } from "@/lib/services/mail-notify.service";
import { logger } from "@/lib/log";
import { guardMailbox } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ address: string }> };

const querySchema = z.object({ folder: z.string().min(1).max(200) });

/** One idle IMAP connection per open tab is fine; a runaway tab is not. */
const MAX_STREAMS_PER_USER = 6;
const KEEPALIVE_MS = 25_000;
const streams = new Map<string, number>();

/**
 * `GET …/events?folder=INBOX` — a server-sent event stream that says when
 * the folder changed (new mail, a move, a flag), fed by IMAP IDLE on a
 * connection of its own. The client refetches on every event; nothing is
 * pushed but the fact of a change, so the stream carries no mail.
 */
export async function GET(req: Request, { params }: Params) {
  const { address } = await params;
  const g = await guardMailbox(address, "events", 60);
  if (!g.ok) return g.res;
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);
  const { folder } = parsed.data;
  const user = g.claims.sub;
  const mailbox = g.access.mailbox.address;
  if ((streams.get(user) ?? 0) >= MAX_STREAMS_PER_USER) {
    return fail({ code: "too_many_streams" }, 429);
  }

  const encoder = new TextEncoder();
  let stop: (() => Promise<void>) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          /* the client went away between the check and the write */
        }
      };
      const close = async () => {
        if (timer) clearInterval(timer);
        timer = null;
        const s = stop;
        stop = null;
        if (s) await s().catch(() => undefined);
        streams.set(user, Math.max(0, (streams.get(user) ?? 1) - 1));
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      streams.set(user, (streams.get(user) ?? 0) + 1);
      try {
        stop = await getMailStore().subscribe(mailbox, folder, (change) => {
          if (change.kind === "error") {
            send("end", { reason: change.detail ?? "closed" });
            void close();
            return;
          }
          // New mail changes what the bell should say; let it recount.
          if (change.kind === "exists") forgetMailFeed(user);
          send("change", { folder: change.folder, kind: change.kind });
        });
      } catch (e) {
        // Tell the browser to come back later rather than every few seconds
        // while the mail server is down; the list keeps polling meanwhile.
        try {
          controller.enqueue(encoder.encode("retry: 60000\n\n"));
        } catch {
          /* already gone */
        }
        await close();
        if (e instanceof MailStoreError) {
          logger.warn("mail events: subscribe failed", { error: e.message });
        }
        return;
      }
      send("ready", { folder });
      // Comments keep proxies and the browser from timing the stream out.
      timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          void close();
        }
      }, KEEPALIVE_MS);
      req.signal.addEventListener("abort", () => void close(), { once: true });
    },
    cancel() {
      if (timer) clearInterval(timer);
      const s = stop;
      stop = null;
      if (s) void s().catch(() => undefined);
      streams.set(user, Math.max(0, (streams.get(user) ?? 1) - 1));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
