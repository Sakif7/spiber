import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Mailbox, type IMailbox } from "@/lib/models/mailbox";
import type { Lean } from "@/lib/models/_shared";
import type { AccessClaims } from "@/lib/auth/tokens";
import { isSuperAdmin } from "@/lib/auth/rbac";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { getMailStore, MailStoreError } from "@/lib/mail/store";
import type {
  FlagPatch,
  ListOptions,
  ListResult,
  MailAddress,
  MailAttachment,
  MailFolder,
  MailMessage,
  SpecialUse,
  StarredOptions,
} from "@/lib/mail/store";
import { sanitizeMailHtml, textToHtml } from "@/lib/mail/sanitize";
import { htmlToText, sanitizeOutgoingHtml } from "@/lib/mail/outgoing-html";
import {
  composeMessage,
  getMailTransport,
  MailTransportError,
  type OutgoingAttachment,
} from "@/lib/mail/transport";
import { mailDomain } from "@/lib/mail/config";
import { findUserById } from "@/lib/repositories/users.repo";
import { siteConfig } from "@/lib/site-config";
import { logger } from "@/lib/log";

/**
 * Who may open which mailbox, and everything the mail page reads.
 *
 * Access is decided by `Mailbox` rows, never by the address alone:
 *   - a personal mailbox: its `ownerUserId`;
 *   - a shared mailbox (info@): everyone in `assignedUserIds`;
 *   - a super admin: any mailbox — and opening one that is not their own is
 *     written to the audit log.
 * The mail itself always comes from the store; nothing is cached here.
 */

export type AccessibleMailbox = {
  address: string;
  kind: "personal" | "shared";
  status: IMailbox["status"];
  /** The signed-in person's own address. */
  own: boolean;
  /** Reachable only because they are a super admin. */
  elevated: boolean;
};

export type MailAccess = {
  mailbox: Lean<IMailbox>;
  own: boolean;
  elevated: boolean;
};

export async function accessibleMailboxes(
  claims: AccessClaims,
): Promise<AccessibleMailbox[]> {
  await connectToDatabase();
  const me = new mongoose.Types.ObjectId(claims.sub);
  const superAdmin = isSuperAdmin(claims);
  const rows = await Mailbox.find(
    superAdmin
      ? { deletedAt: null, status: { $in: ["active", "disabled"] } }
      : {
          deletedAt: null,
          status: { $in: ["active", "disabled"] },
          $or: [{ ownerUserId: me }, { assignedUserIds: me }],
        },
  )
    .sort({ kind: 1, address: 1 })
    .lean<Lean<IMailbox>[]>()
    .exec();
  const out = rows.map<AccessibleMailbox>((r) => {
    const own = String(r.ownerUserId ?? "") === claims.sub;
    const assigned = (r.assignedUserIds ?? []).some(
      (id) => String(id) === claims.sub,
    );
    return {
      address: r.address,
      kind: r.kind,
      status: r.status,
      own,
      elevated: !own && !assigned,
    };
  });
  // Own first, then shared ones I am assigned to, then everything else.
  return out.sort(
    (a, b) =>
      Number(b.own) - Number(a.own) ||
      Number(a.elevated) - Number(b.elevated) ||
      a.address.localeCompare(b.address),
  );
}

/** Null when the person may not open this mailbox (→ 403/404). */
export async function mailboxAccess(
  claims: AccessClaims,
  address: string,
): Promise<MailAccess | null> {
  await connectToDatabase();
  const mailbox = await Mailbox.findOne({
    address: address.trim().toLowerCase(),
    deletedAt: null,
    status: { $in: ["active", "disabled"] },
  })
    .lean<Lean<IMailbox>>()
    .exec();
  if (!mailbox) return null;
  const own = String(mailbox.ownerUserId ?? "") === claims.sub;
  const assigned = (mailbox.assignedUserIds ?? []).some(
    (id) => String(id) === claims.sub,
  );
  if (own || assigned) return { mailbox, own, elevated: false };
  if (isSuperAdmin(claims)) return { mailbox, own: false, elevated: true };
  return null;
}

// ───────────────────────────── reading ─────────────────────────────

export async function listFolders(
  access: MailAccess,
  claims: AccessClaims,
  req?: Request,
): Promise<MailFolder[]> {
  const folders = await getMailStore().listFolders(access.mailbox.address);
  // Opening somebody else's mailbox is the sensitive act; log it once per
  // folder listing (the page does one on open), not per message.
  if (access.elevated) {
    await writeAudit(
      {
        actorId: claims.sub,
        action: "mail.mailbox.open",
        entityType: "Mailbox",
        entityId: String(access.mailbox._id),
        after: { address: access.mailbox.address },
      },
      req,
    ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  }
  return folders;
}

export function listMessages(
  access: MailAccess,
  folder: string,
  opts: ListOptions,
): Promise<ListResult> {
  return getMailStore().listMessages(access.mailbox.address, folder, opts);
}

export type RenderedMessage = Omit<MailMessage, "html" | "text"> & {
  /** Safe to inject. */
  html: string;
  blockedRemoteImages: number;
  /** Plain text for the reply quote. */
  text: string | null;
};

export async function getMessage(
  access: MailAccess,
  folder: string,
  uid: number,
  opts: { allowRemoteImages?: boolean; markSeen?: boolean } = {},
): Promise<RenderedMessage | null> {
  const store = getMailStore();
  const address = access.mailbox.address;
  const msg = await store.getMessage(address, folder, uid);
  if (!msg) return null;
  const base = `/api/admin/mail/${encodeURIComponent(address)}/messages/${uid}/attachments`;
  const byCid = new Map(
    msg.attachments.filter((a) => a.cid).map((a) => [a.cid!, a.index]),
  );
  const q = `?folder=${encodeURIComponent(folder)}&inline=1`;
  const rendered = msg.html
    ? sanitizeMailHtml(msg.html, {
        allowRemoteImages: opts.allowRemoteImages,
        cidUrl: (cid) => {
          const i = byCid.get(cid);
          return i === undefined ? null : `${base}/${i}${q}`;
        },
      })
    : { html: textToHtml(msg.text ?? ""), blockedRemoteImages: 0 };
  if (opts.markSeen !== false && !msg.seen) {
    // Reading marks read, like every mail client; best-effort.
    await store
      .setFlags(address, folder, [uid], { seen: true })
      .catch((e) => logger.warn("mark seen failed", { error: String(e) }));
    msg.seen = true;
  }
  const { html: _h, text, ...rest } = msg;
  void _h;
  return {
    ...rest,
    text,
    html: rendered.html,
    blockedRemoteImages: rendered.blockedRemoteImages,
  };
}

export function getAttachment(
  access: MailAccess,
  folder: string,
  uid: number,
  index: number,
): Promise<MailAttachment | null> {
  return getMailStore().getAttachment(
    access.mailbox.address,
    folder,
    uid,
    index,
  );
}

export function setFlags(
  access: MailAccess,
  folder: string,
  uids: number[],
  patch: FlagPatch,
): Promise<void> {
  return getMailStore().setFlags(access.mailbox.address, folder, uids, patch);
}

export type MoveTarget = "trash" | "archive" | "inbox" | "junk";

/** Starred across the mailbox (every folder but Junk and Trash). */
export function listStarred(
  access: MailAccess,
  opts: StarredOptions,
): Promise<ListResult> {
  return getMailStore().listStarred(access.mailbox.address, opts);
}

// ───────────────────────────── folders ─────────────────────────────

/**
 * Folder names are what IMAP accepts everywhere and what reads well in a
 * rail: 1–40 characters, letters/digits/spaces and - _ & ( ), no leading or
 * trailing space, never a path separator. Nesting goes through `parent`.
 */
export const FOLDER_NAME = /^[\p{L}\p{N}][\p{L}\p{N} \-_&()]{0,39}$/u;

export type FolderResult =
  | { ok: true; folder: MailFolder }
  | {
      ok: false;
      code: "invalid_name" | "exists" | "not_found" | "reserved" | "not_empty";
    };

function folderNameOk(name: string): boolean {
  return FOLDER_NAME.test(name) && !name.endsWith(" ");
}

/** The standard folders and Inbox are the server's; only custom ones are ours to touch. */
function customFolder(folders: MailFolder[], path: string): MailFolder | null {
  const f = folders.find((x) => x.path === path);
  return f && !f.specialUse ? f : null;
}

export async function createFolder(
  access: MailAccess,
  claims: AccessClaims,
  name: string,
  parent?: string,
  req?: Request,
): Promise<FolderResult> {
  const clean = name.trim();
  if (!folderNameOk(clean)) return { ok: false, code: "invalid_name" };
  const store = getMailStore();
  const address = access.mailbox.address;
  const folders = await store.listFolders(address);
  const delimiter = folders[0]?.delimiter ?? ".";
  if (parent && !folders.some((f) => f.path === parent)) {
    return { ok: false, code: "not_found" };
  }
  const path = parent ? `${parent}${delimiter}${clean}` : clean;
  if (folders.some((f) => f.path.toLowerCase() === path.toLowerCase())) {
    return { ok: false, code: "exists" };
  }
  if (!parent && /^inbox$/i.test(clean)) return { ok: false, code: "reserved" };
  try {
    const folder = await store.createFolder(address, path);
    await writeAudit(
      {
        actorId: claims.sub,
        action: "mail.folder.create",
        entityType: "Mailbox",
        entityId: String(access.mailbox._id),
        after: { address, path },
      },
      req,
    ).catch((e) => logger.warn("audit failed", { error: String(e) }));
    return { ok: true, folder };
  } catch (e) {
    if (e instanceof MailStoreError && e.code === "exists") {
      return { ok: false, code: "exists" };
    }
    throw e;
  }
}

export async function renameFolder(
  access: MailAccess,
  claims: AccessClaims,
  path: string,
  name: string,
  req?: Request,
): Promise<FolderResult> {
  const clean = name.trim();
  if (!folderNameOk(clean)) return { ok: false, code: "invalid_name" };
  const store = getMailStore();
  const address = access.mailbox.address;
  const folders = await store.listFolders(address);
  const target = customFolder(folders, path);
  if (!target) {
    return {
      ok: false,
      code: folders.some((f) => f.path === path) ? "reserved" : "not_found",
    };
  }
  const delimiter = target.delimiter || ".";
  const parent = path.includes(delimiter)
    ? path.slice(0, path.lastIndexOf(delimiter))
    : "";
  const newPath = parent ? `${parent}${delimiter}${clean}` : clean;
  if (newPath === path) return { ok: true, folder: target };
  if (folders.some((f) => f.path.toLowerCase() === newPath.toLowerCase())) {
    return { ok: false, code: "exists" };
  }
  try {
    await store.renameFolder(address, path, newPath);
  } catch (e) {
    if (e instanceof MailStoreError && e.code === "exists") {
      return { ok: false, code: "exists" };
    }
    throw e;
  }
  await writeAudit(
    {
      actorId: claims.sub,
      action: "mail.folder.rename",
      entityType: "Mailbox",
      entityId: String(access.mailbox._id),
      before: { path },
      after: { address, path: newPath },
    },
    req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  return { ok: true, folder: { ...target, path: newPath, name: clean } };
}

/** Only an empty custom folder — messages are never deleted by deleting a folder. */
export async function deleteFolder(
  access: MailAccess,
  claims: AccessClaims,
  path: string,
  req?: Request,
): Promise<{ ok: true } | Exclude<FolderResult, { ok: true }>> {
  const store = getMailStore();
  const address = access.mailbox.address;
  const folders = await store.listFolders(address);
  const target = customFolder(folders, path);
  if (!target) {
    return {
      ok: false,
      code: folders.some((f) => f.path === path) ? "reserved" : "not_found",
    };
  }
  const delimiter = target.delimiter || ".";
  const hasChildren = folders.some((f) => f.path.startsWith(path + delimiter));
  if (target.total > 0 || hasChildren) return { ok: false, code: "not_empty" };
  try {
    await store.deleteFolder(address, path);
  } catch (e) {
    if (e instanceof MailStoreError && e.code === "not_empty") {
      return { ok: false, code: "not_empty" };
    }
    throw e;
  }
  await writeAudit(
    {
      actorId: claims.sub,
      action: "mail.folder.delete",
      entityType: "Mailbox",
      entityId: String(access.mailbox._id),
      before: { address, path },
    },
    req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  return { ok: true };
}

/** Move to a folder by path (the "Move to…" menu); trash/junk targets are audited like the named moves. */
export async function moveMessagesTo(
  access: MailAccess,
  claims: AccessClaims,
  folder: string,
  uids: number[],
  targetPath: string,
  req?: Request,
): Promise<{ ok: true; target: string } | { ok: false; code: "no_folder" }> {
  const store = getMailStore();
  const address = access.mailbox.address;
  const folders = await store.listFolders(address);
  const target = folders.find((f) => f.path === targetPath);
  if (!target || target.path === folder)
    return { ok: false, code: "no_folder" };
  await store.move(address, folder, uids, target.path);
  if (target.specialUse === "trash" || target.specialUse === "junk") {
    await writeAudit(
      {
        actorId: claims.sub,
        action: `mail.message.${target.specialUse}`,
        entityType: "Mailbox",
        entityId: String(access.mailbox._id),
        after: { address, folder, uids },
      },
      req,
    ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  }
  return { ok: true, target: target.path };
}

/**
 * Move by meaning ("trash") rather than by path, so the UI never has to know
 * that Dovecot calls it "Trash" and Gmail-imported folders call it
 * "[Gmail]/Bin". Deleting from Trash is the only permanent removal, and it is
 * audited like any delete.
 */
export async function moveMessages(
  access: MailAccess,
  claims: AccessClaims,
  folder: string,
  uids: number[],
  to: MoveTarget,
  req?: Request,
): Promise<{ ok: true; target: string } | { ok: false; code: "no_folder" }> {
  const store = getMailStore();
  const address = access.mailbox.address;
  const folders = await store.listFolders(address);
  const want: SpecialUse = to;
  const target = folders.find((f) => f.specialUse === want);
  if (!target) return { ok: false, code: "no_folder" };
  await store.move(address, folder, uids, target.path);
  if (to === "trash" || to === "junk") {
    await writeAudit(
      {
        actorId: claims.sub,
        action: `mail.message.${to}`,
        entityType: "Mailbox",
        entityId: String(access.mailbox._id),
        after: { address, folder, uids },
      },
      req,
    ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  }
  return { ok: true, target: target.path };
}

// ───────────────────────────── sending ─────────────────────────────

export type SendInput = {
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  subject: string;
  /** Plain text as typed; the HTML alternative is derived from it… */
  text: string;
  /** …unless the composer sent rich text: sanitised here, text derived from it. */
  html?: string | null;
  attachments: OutgoingAttachment[];
  /** Replying: the original, so threading headers and \\Answered are set. */
  inReplyTo?: { folder: string; uid: number } | null;
  /** Forwarding: attach these attachment indexes of the original. */
  forwardOf?: {
    folder: string;
    uid: number;
    attachmentIndexes: number[];
  } | null;
};

export type SendOutcome = {
  messageId: string;
  /** Whether the copy landed in Sent (best-effort). */
  filed: boolean;
};

const MAX_RECIPIENTS = 50;
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

/**
 * Send as the mailbox. Composed once; delivered through the transport;
 * the same bytes filed into the Sent folder; the original marked answered;
 * every send audited with its recipients — that is what "every send is
 * audited" in the design means.
 */
export async function sendMessage(
  access: MailAccess,
  claims: AccessClaims,
  input: SendInput,
  req?: Request,
): Promise<
  | { ok: true; data: SendOutcome }
  | {
      ok: false;
      code:
        | "no_recipients"
        | "too_many_recipients"
        | "too_large"
        | "transport_not_configured"
        | "transport_failed";
      detail?: string;
    }
> {
  const store = getMailStore();
  const address = access.mailbox.address;
  const recipients = [...input.to, ...input.cc, ...input.bcc];
  if (recipients.length === 0) return { ok: false, code: "no_recipients" };
  if (recipients.length > MAX_RECIPIENTS)
    return { ok: false, code: "too_many_recipients" };

  // The sender's display name: the person for their own mailbox, the
  // company for a shared one.
  let name: string | null = null;
  if (access.mailbox.kind === "personal") {
    const user = await findUserById(claims.sub).catch(() => null);
    name = user?.name ?? null;
  } else {
    name = siteConfig.brand;
  }

  const attachments = [...input.attachments];
  let inReplyTo: string | null = null;
  let references: string[] = [];
  if (input.inReplyTo) {
    const original = await store.getMessage(
      address,
      input.inReplyTo.folder,
      input.inReplyTo.uid,
    );
    if (original?.messageId) {
      inReplyTo = original.messageId;
      references = [...original.references, original.messageId].slice(-20);
    }
  }
  if (input.forwardOf) {
    for (const i of input.forwardOf.attachmentIndexes) {
      const a = await store.getAttachment(
        address,
        input.forwardOf.folder,
        input.forwardOf.uid,
        i,
      );
      if (a)
        attachments.push({
          filename: a.filename,
          contentType: a.contentType,
          content: a.content,
        });
    }
  }
  const bytes =
    attachments.reduce((n, a) => n + a.content.length, 0) +
    input.text.length +
    (input.html?.length ?? 0);
  if (bytes > MAX_MESSAGE_BYTES) return { ok: false, code: "too_large" };

  let transport;
  try {
    transport = getMailTransport();
  } catch (e) {
    return { ok: false, code: "transport_not_configured", detail: String(e) };
  }
  // Browsers submit textareas with CRLF; keep one convention before the
  // composer re-encodes line endings for the wire.
  const richHtml = input.html ? sanitizeOutgoingHtml(input.html) : "";
  const text = richHtml
    ? htmlToText(richHtml)
    : input.text.replace(/\r\n?/g, "\n");
  const html = richHtml || textToHtml(text);
  const composed = await composeMessage(
    {
      from: { name, address },
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject.trim() || "(no subject)",
      text,
      html,
      attachments,
      inReplyTo,
      references,
    },
    mailDomain(),
  );
  try {
    await transport.deliver(address, composed);
  } catch (e) {
    const detail = e instanceof MailTransportError ? e.message : String(e);
    return {
      ok: false,
      code:
        e instanceof MailTransportError && e.code === "not_configured"
          ? "transport_not_configured"
          : "transport_failed",
      detail,
    };
  }

  // Sent copy + answered flag: best-effort, never a failed send.
  let filed = false;
  try {
    const folders = await store.listFolders(address);
    const sent = folders.find((f) => f.specialUse === "sent");
    if (sent) {
      await store.append(address, sent.path, composed.raw, ["\\Seen"]);
      filed = true;
    }
  } catch (e) {
    logger.warn("sent copy not filed", { address, error: String(e) });
  }
  if (input.inReplyTo) {
    await store
      .setFlags(address, input.inReplyTo.folder, [input.inReplyTo.uid], {
        answered: true,
      })
      .catch((e) => logger.warn("answered flag failed", { error: String(e) }));
  }
  await writeAudit(
    {
      actorId: claims.sub,
      action: "mail.message.send",
      entityType: "Mailbox",
      entityId: String(access.mailbox._id),
      after: {
        from: address,
        to: recipients.map((r) => r.address),
        subject: input.subject.trim().slice(0, 200),
        messageId: composed.messageId,
        attachments: attachments.length,
        transport: transport.name,
      },
    },
    req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  return { ok: true, data: { messageId: composed.messageId, filed } };
}

export { MailStoreError };
