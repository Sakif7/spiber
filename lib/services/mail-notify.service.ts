import type { AccessClaims } from "@/lib/auth/tokens";
import { isEmployee } from "@/lib/auth/rbac";
import { getMailStore } from "@/lib/mail/store";
import { accessibleMailboxes } from "@/lib/services/mail.service";
import { logger } from "@/lib/log";

/**
 * New mail for the topbar bell. Every ~30 s the bell asks; this peeks at the
 * inbox of each mailbox the person may read as themselves (own + assigned),
 * plus every shared mailbox for a super admin — company mail, nobody's
 * private inbox. A colleague's personal mailbox never appears here: the
 * super admin's elevated reach is audited on open and does not belong in a
 * passive feed. Returns the newest unread messages.
 *
 * Cached per person for a short while so a few open tabs cost one IMAP
 * round per mailbox, and bounded so a slow mail server never holds the
 * business feed hostage: on timeout the last good answer is served.
 */
export type MailFeedItem = {
  /** `mail:<address>:<folder>:<uid>` — stable across polls. */
  id: string;
  address: string;
  folder: string;
  uid: number;
  from: string;
  subject: string;
  href: string;
  date: string;
};

export type MailFeed = {
  /** Unread messages across the person's inboxes. */
  unread: number;
  items: MailFeedItem[];
};

const CACHE_MS = 20_000;
const BUDGET_MS = 8_000;
const PER_MAILBOX = 5;
const EMPTY: MailFeed = { unread: 0, items: [] };

type Entry = { at: number; feed: MailFeed; pending: Promise<MailFeed> | null };
const cache = new Map<string, Entry>();

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

/** Where the bell sends the person: the portal for employees, Company → Mail otherwise. */
export function mailHref(
  claims: AccessClaims,
  address: string,
  folder: string,
  uid: number,
): string {
  const base = isEmployee(claims) ? "/admin/me/mail" : "/admin/mail";
  return `${base}?mailbox=${encodeURIComponent(address)}&folder=${encodeURIComponent(folder)}&uid=${uid}`;
}

async function compute(claims: AccessClaims): Promise<MailFeed> {
  const boxes = (await accessibleMailboxes(claims)).filter(
    (m) => m.status === "active" && (!m.elevated || m.kind === "shared"),
  );
  if (boxes.length === 0) return EMPTY;
  const store = getMailStore();
  const results = await Promise.allSettled(
    boxes.map(async (box) => {
      const folders = await store.listFolders(box.address);
      const inbox = folders.find((f) => f.specialUse === "inbox");
      if (!inbox || inbox.unseen === 0) return { unread: 0, items: [] };
      const page = await store.listMessages(box.address, inbox.path, {
        page: 1,
        pageSize: PER_MAILBOX,
        unseenOnly: true,
      });
      return {
        unread: inbox.unseen,
        items: page.items.map<MailFeedItem>((m) => ({
          id: `mail:${box.address}:${inbox.path}:${m.uid}`,
          address: box.address,
          folder: inbox.path,
          uid: m.uid,
          from: m.from ? m.from.name || m.from.address : "Unknown sender",
          subject: m.subject,
          href: mailHref(claims, box.address, inbox.path, m.uid),
          date: m.date ?? new Date().toISOString(),
        })),
      };
    }),
  );
  const feed: MailFeed = { unread: 0, items: [] };
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      feed.unread += r.value.unread;
      feed.items.push(...r.value.items);
    } else {
      logger.warn("mail feed: mailbox skipped", {
        address: boxes[i].address,
        error: String(r.reason),
      });
    }
  });
  feed.items.sort((a, b) => b.date.localeCompare(a.date));
  return feed;
}

/** Unread mail for this person, cached ~20 s and never slower than ~8 s. */
export async function mailFeed(claims: AccessClaims): Promise<MailFeed> {
  const key = claims.sub;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.feed;
  if (hit?.pending) return withTimeout(hit.pending, BUDGET_MS, hit.feed);

  const pending = compute(claims)
    .catch((e) => {
      logger.warn("mail feed failed", { error: String(e) });
      return hit?.feed ?? EMPTY;
    })
    .then((feed) => {
      cache.set(key, { at: Date.now(), feed, pending: null });
      return feed;
    });
  cache.set(key, { at: hit?.at ?? 0, feed: hit?.feed ?? EMPTY, pending });
  return withTimeout(pending, BUDGET_MS, hit?.feed ?? EMPTY);
}

/** Tests and sign-out: forget what was cached for a person. */
export function forgetMailFeed(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}
