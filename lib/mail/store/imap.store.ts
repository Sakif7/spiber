import { ImapFlow, type MessageStructureObject } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import { logger } from "@/lib/log";
import {
  decodePart,
  pickPreviewPart,
  previewText,
  type PreviewPart,
} from "@/lib/mail/preview";
import {
  MailStoreError,
  type FlagPatch,
  type ListResult,
  type MailAddress,
  type MailAttachment,
  type MailAttachmentMeta,
  type MailChange,
  type MailFolder,
  type MailListItem,
  type MailMessage,
  type MailStore,
  type SpecialUse,
} from "./types";

/**
 * The company mail server over IMAPS, opened with the Dovecot **master
 * user**: the login is `<mailbox>*<master user>` with the master password, so
 * the app never holds a person's own mailbox password to read their mail.
 *
 *   MAIL_IMAP_HOST / MAIL_IMAP_PORT   mail.spibermed.com / 993
 *   MAIL_MASTER_USER / MAIL_MASTER_PASSWORD
 *
 * One connection per call, closed in `finally`. Simple and correct first;
 * a small pool can come later if the list page ever feels slow.
 */
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const MASTER_SEPARATOR = "*";

function config() {
  const host = process.env.MAIL_IMAP_HOST?.trim();
  const user = process.env.MAIL_MASTER_USER?.trim();
  const pass = process.env.MAIL_MASTER_PASSWORD;
  if (!host || !user || !pass) {
    throw new MailStoreError(
      "not_configured",
      "MAIL_STORE=imap needs MAIL_IMAP_HOST, MAIL_MASTER_USER and MAIL_MASTER_PASSWORD",
    );
  }
  return { host, port: Number(process.env.MAIL_IMAP_PORT || 993), user, pass };
}

async function withClient<T>(
  address: string,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const c = config();
  const client = new ImapFlow({
    host: c.host,
    port: c.port,
    secure: true,
    auth: { user: `${address}${MASTER_SEPARATOR}${c.user}`, pass: c.pass },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
  try {
    await client.connect();
  } catch (e) {
    const err = e as { authenticationFailed?: boolean; message?: string };
    logger.error("imap connect failed", { address, error: String(e) });
    throw new MailStoreError(
      err.authenticationFailed ? "auth_failed" : "unavailable",
      err.message,
    );
  }
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

const SPECIAL: Record<string, SpecialUse> = {
  "\\Inbox": "inbox",
  "\\Sent": "sent",
  "\\Drafts": "drafts",
  "\\Junk": "junk",
  "\\Trash": "trash",
  "\\Archive": "archive",
};

function specialUseOf(path: string, flag?: string): SpecialUse {
  if (path.toUpperCase() === "INBOX") return "inbox";
  return flag ? (SPECIAL[flag] ?? null) : null;
}

const addr = (
  a?: { name?: string; address?: string } | null,
): MailAddress | null =>
  a?.address ? { name: a.name?.trim() || null, address: a.address } : null;

/** Does any leaf of the structure look like an attachment? */
function hasAttachmentNode(node?: MessageStructureObject): boolean {
  if (!node) return false;
  if (node.childNodes?.length) return node.childNodes.some(hasAttachmentNode);
  if (node.disposition?.toLowerCase() === "attachment") return true;
  const type = node.type?.toLowerCase() ?? "";
  return !type.startsWith("text/") && !type.startsWith("multipart/");
}

const iso = (d?: Date | string | null): string | null => {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
};

function parsedAddresses(v?: AddressObject | AddressObject[]): MailAddress[] {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return list.flatMap((o) =>
    (o.value ?? [])
      .filter((x) => x.address)
      .map((x) => ({ name: x.name?.trim() || null, address: x.address! })),
  );
}

function attachmentMeta(mail: ParsedMail): MailAttachmentMeta[] {
  return (mail.attachments ?? []).map((a, index) => ({
    index,
    filename: a.filename || `attachment-${index + 1}`,
    contentType: a.contentType || "application/octet-stream",
    size: a.size ?? a.content?.length ?? 0,
    cid: a.cid ?? a.contentId?.replace(/^<|>$/g, "") ?? null,
    inline: a.contentDisposition === "inline" || Boolean(a.related),
  }));
}

/**
 * List previews without downloading messages: peek at the first few KB of
 * each message's text part. One FETCH per distinct part id (most pages need
 * two or three), so a page costs a handful of round trips, not one per row.
 * Best-effort — a failed peek leaves the preview empty.
 */
const PREVIEW_BYTES = 4096;

async function fillPreviews(
  client: ImapFlow,
  items: MailListItem[],
  parts: Map<number, PreviewPart>,
): Promise<void> {
  const byKey = new Map<string, number[]>();
  for (const [uid, p] of parts) {
    byKey.set(p.key, [...(byKey.get(p.key) ?? []), uid]);
  }
  const previews = new Map<number, string>();
  for (const [key, uids] of byKey) {
    try {
      for await (const m of client.fetch(
        uids,
        { uid: true, bodyParts: [{ key, maxLength: PREVIEW_BYTES }] },
        { uid: true },
      )) {
        const part = parts.get(m.uid);
        const raw = m.bodyParts?.get(key.toLowerCase());
        if (!part || !raw) continue;
        previews.set(
          m.uid,
          previewText(decodePart(raw, part.encoding, part.charset), part.html),
        );
      }
    } catch (e) {
      logger.warn("mail preview fetch failed", { key, error: String(e) });
    }
  }
  for (const item of items) item.preview = previews.get(item.uid) ?? "";
}

const STARRED_PER_FOLDER = 200;

/** Envelope-level rows for a set of UIDs in the selected folder, previews optional. */
async function fetchItems(
  client: ImapFlow,
  folder: string,
  uids: number[],
  withPreviews: boolean,
): Promise<MailListItem[]> {
  const items: MailListItem[] = [];
  if (uids.length === 0) return items;
  const previewParts = new Map<number, PreviewPart>();
  for await (const m of client.fetch(
    uids,
    {
      uid: true,
      flags: true,
      envelope: true,
      bodyStructure: true,
      size: true,
      internalDate: true,
    },
    { uid: true },
  )) {
    const flags = m.flags ?? new Set<string>();
    const part = pickPreviewPart(m.bodyStructure);
    if (part) previewParts.set(m.uid, part);
    items.push({
      uid: m.uid,
      folder,
      subject: m.envelope?.subject?.trim() || "(no subject)",
      from: addr(m.envelope?.from?.[0]),
      date: iso(m.envelope?.date) ?? iso(m.internalDate),
      seen: flags.has("\\Seen"),
      flagged: flags.has("\\Flagged"),
      answered: flags.has("\\Answered"),
      hasAttachments: hasAttachmentNode(m.bodyStructure),
      size: m.size ?? null,
      preview: "",
    });
  }
  if (withPreviews) await fillPreviews(client, items, previewParts);
  return items;
}

/** IMAP says "already exists" / "does not exist" in prose; map what we can. */
function folderError(e: unknown, path: string): MailStoreError {
  const msg = String((e as { responseText?: string })?.responseText ?? e);
  if (/exist/i.test(msg) && /already|exists/i.test(msg)) {
    return new MailStoreError("exists", path);
  }
  if (/not exist|no such|unknown/i.test(msg)) {
    return new MailStoreError("not_found", path);
  }
  return new MailStoreError("unavailable", msg);
}

async function downloadSource(
  client: ImapFlow,
  uid: number,
): Promise<Buffer | null> {
  const msg = await client.fetchOne(String(uid), { size: true }, { uid: true });
  if (!msg) return null;
  if ((msg.size ?? 0) > MAX_SOURCE_BYTES) {
    throw new MailStoreError("too_large", `${msg.size} bytes`);
  }
  const { content } = await client.download(String(uid), undefined, {
    uid: true,
  });
  const chunks: Buffer[] = [];
  for await (const chunk of content) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export const imapStore: MailStore = {
  name: "imap",

  async listFolders(address) {
    return withClient(address, async (client) => {
      const list = await client.list({
        statusQuery: { messages: true, unseen: true },
      });
      const folders: MailFolder[] = list
        .filter((f) => f.listed && !f.flags.has("\\NonExistent"))
        .map((f) => ({
          path: f.path,
          name: f.path.toUpperCase() === "INBOX" ? "Inbox" : f.name,
          specialUse: specialUseOf(f.path, f.specialUse),
          delimiter: f.delimiter,
          total: f.status?.messages ?? 0,
          unseen: f.status?.unseen ?? 0,
        }));
      const order: Record<string, number> = {
        inbox: 0,
        drafts: 1,
        sent: 2,
        archive: 3,
        junk: 4,
        trash: 5,
      };
      return folders.sort((a, b) => {
        const ra = a.specialUse ? order[a.specialUse] : 10;
        const rb = b.specialUse ? order[b.specialUse] : 10;
        return ra - rb || a.path.localeCompare(b.path);
      });
    });
  },

  async listMessages(address, folder, opts): Promise<ListResult> {
    return withClient(address, async (client) => {
      const lock = await client.getMailboxLock(folder, { readOnly: true });
      try {
        const query: Record<string, unknown> = {};
        const q = opts.query?.trim();
        if (q) {
          // Dovecot searches these on the server side (FTS when configured).
          query.or = [{ subject: q }, { from: q }, { to: q }, { body: q }];
        }
        if (opts.unseenOnly) query.seen = false;
        const uidsRaw = await client.search(
          Object.keys(query).length ? query : { all: true },
          { uid: true },
        );
        const uids = Array.isArray(uidsRaw) ? uidsRaw : [];
        // Newest first: UIDs are assigned in arrival order.
        uids.sort((a, b) => b - a);
        const total = uids.length;
        const start = (opts.page - 1) * opts.pageSize;
        const pageUids = uids.slice(start, start + opts.pageSize);
        const items = await fetchItems(client, folder, pageUids, true);
        // fetch() yields in sequence order; keep the page newest-first.
        items.sort((a, b) => b.uid - a.uid);
        return { items, total, page: opts.page, pageSize: opts.pageSize };
      } finally {
        lock.release();
      }
    });
  },

  async listStarred(address, opts): Promise<ListResult> {
    return withClient(address, async (client) => {
      const list = await client.list();
      const folders = list.filter(
        (f) =>
          f.listed &&
          !f.flags.has("\\NonExistent") &&
          !f.flags.has("\\Noselect") &&
          !["junk", "trash"].includes(specialUseOf(f.path, f.specialUse) ?? ""),
      );
      // Starred sets are small: gather every flagged row (envelope only),
      // sort across folders by date, then fetch previews for the one page.
      const all: MailListItem[] = [];
      for (const f of folders) {
        const lock = await client.getMailboxLock(f.path, { readOnly: true });
        try {
          const uidsRaw = await client.search({ flagged: true }, { uid: true });
          const uids = (Array.isArray(uidsRaw) ? uidsRaw : [])
            .sort((a, b) => b - a)
            .slice(0, STARRED_PER_FOLDER);
          all.push(...(await fetchItems(client, f.path, uids, false)));
        } finally {
          lock.release();
        }
      }
      all.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
      const start = (opts.page - 1) * opts.pageSize;
      const page = all.slice(start, start + opts.pageSize);
      const byFolder = new Map<string, MailListItem[]>();
      for (const it of page) {
        byFolder.set(it.folder, [...(byFolder.get(it.folder) ?? []), it]);
      }
      for (const [path, rows] of byFolder) {
        const lock = await client.getMailboxLock(path, { readOnly: true });
        try {
          const fresh = await fetchItems(
            client,
            path,
            rows.map((r) => r.uid),
            true,
          );
          const previews = new Map(fresh.map((r) => [r.uid, r.preview]));
          for (const r of rows) r.preview = previews.get(r.uid) ?? "";
        } finally {
          lock.release();
        }
      }
      return {
        items: page,
        total: all.length,
        page: opts.page,
        pageSize: opts.pageSize,
      };
    });
  },

  async createFolder(address, path) {
    return withClient(address, async (client) => {
      try {
        const res = await client.mailboxCreate(path);
        return {
          path: res.path,
          name: res.path.split(/[./]/).pop() ?? res.path,
          specialUse: null,
          delimiter: ".",
          total: 0,
          unseen: 0,
        };
      } catch (e) {
        throw folderError(e, path);
      }
    });
  },

  async renameFolder(address, path, newPath) {
    await withClient(address, async (client) => {
      try {
        await client.mailboxRename(path, newPath);
      } catch (e) {
        throw folderError(e, newPath);
      }
    });
  },

  async deleteFolder(address, path) {
    await withClient(address, async (client) => {
      const status = await client.status(path, { messages: true });
      if ((status.messages ?? 0) > 0) {
        throw new MailStoreError("not_empty", path);
      }
      try {
        await client.mailboxDelete(path);
      } catch (e) {
        throw folderError(e, path);
      }
    });
  },

  async getMessage(address, folder, uid) {
    return withClient(address, async (client) => {
      const lock = await client.getMailboxLock(folder, { readOnly: true });
      try {
        const source = await downloadSource(client, uid);
        if (!source) return null;
        const flagsMsg = await client.fetchOne(
          String(uid),
          { flags: true },
          { uid: true },
        );
        const flags = flagsMsg
          ? (flagsMsg.flags ?? new Set<string>())
          : new Set<string>();
        const mail = await simpleParser(source, {
          skipImageLinks: true,
          skipTextLinks: true,
        });
        const from = parsedAddresses(mail.from)[0] ?? null;
        const refs = mail.references
          ? Array.isArray(mail.references)
            ? mail.references
            : [mail.references]
          : [];
        const msg: MailMessage = {
          uid,
          messageId: mail.messageId ?? null,
          subject: mail.subject?.trim() || "(no subject)",
          from,
          to: parsedAddresses(mail.to),
          cc: parsedAddresses(mail.cc),
          replyTo: parsedAddresses(mail.replyTo),
          date: iso(mail.date),
          seen: flags.has("\\Seen"),
          flagged: flags.has("\\Flagged"),
          answered: flags.has("\\Answered"),
          html: typeof mail.html === "string" ? mail.html : null,
          text: mail.text ?? null,
          attachments: attachmentMeta(mail),
          inReplyTo: mail.inReplyTo ?? null,
          references: refs,
        };
        return msg;
      } finally {
        lock.release();
      }
    });
  },

  async getAttachment(address, folder, uid, index) {
    return withClient(address, async (client) => {
      const lock = await client.getMailboxLock(folder, { readOnly: true });
      try {
        const source = await downloadSource(client, uid);
        if (!source) return null;
        const mail = await simpleParser(source);
        const a = mail.attachments?.[index];
        if (!a) return null;
        const out: MailAttachment = {
          filename: a.filename || `attachment-${index + 1}`,
          contentType: a.contentType || "application/octet-stream",
          content: a.content,
        };
        return out;
      } finally {
        lock.release();
      }
    });
  },

  async setFlags(address, folder, uids, patch: FlagPatch) {
    if (!uids.length) return;
    await withClient(address, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const add: string[] = [];
        const remove: string[] = [];
        if (patch.seen === true) add.push("\\Seen");
        if (patch.seen === false) remove.push("\\Seen");
        if (patch.flagged === true) add.push("\\Flagged");
        if (patch.flagged === false) remove.push("\\Flagged");
        if (patch.answered === true) add.push("\\Answered");
        if (patch.answered === false) remove.push("\\Answered");
        if (add.length) await client.messageFlagsAdd(uids, add, { uid: true });
        if (remove.length) {
          await client.messageFlagsRemove(uids, remove, { uid: true });
        }
      } finally {
        lock.release();
      }
    });
  },

  async append(address, folder, raw, flags) {
    await withClient(address, async (client) => {
      const res = await client.append(folder, raw, flags);
      if (res === false)
        throw new MailStoreError("unavailable", "append refused");
    });
  },

  /**
   * A connection of its own that sits in IDLE on the folder (imapflow idles
   * whenever no command is running) and relays the server's untagged
   * updates. Ended by the returned function, or by the server dropping the
   * link — reported as an "error" change so the caller reconnects.
   */
  async subscribe(address, folder, onChange) {
    const c = config();
    const client = new ImapFlow({
      host: c.host,
      port: c.port,
      secure: true,
      auth: { user: `${address}${MASTER_SEPARATOR}${c.user}`, pass: c.pass },
      logger: false,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      // IDLE re-issues itself well inside this; a dead link is noticed here.
      socketTimeout: 10 * 60_000,
    });
    let ended = false;
    const report = (kind: MailChange["kind"], detail?: string) => {
      if (!ended) onChange({ folder, kind, detail });
    };
    client.on("exists", () => report("exists"));
    client.on("expunge", () => report("expunge"));
    client.on("flags", () => report("flags"));
    client.on("error", (e: Error) => report("error", e.message));
    client.on("close", () => report("error", "connection closed"));
    try {
      await client.connect();
      await client.mailboxOpen(folder, { readOnly: true });
    } catch (e) {
      ended = true;
      await client.logout().catch(() => client.close());
      const err = e as { authenticationFailed?: boolean; message?: string };
      throw new MailStoreError(
        err.authenticationFailed ? "auth_failed" : "unavailable",
        err.message,
      );
    }
    return async () => {
      ended = true;
      await client.logout().catch(() => client.close());
    };
  },

  async move(address, folder, uids, targetPath) {
    if (!uids.length) return;
    await withClient(address, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const res = await client.messageMove(uids, targetPath, { uid: true });
        if (res === false)
          throw new MailStoreError("unavailable", "move refused");
      } finally {
        lock.release();
      }
    });
  },
};
