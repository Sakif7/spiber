/**
 * Reading a mailbox. One interface, two stores: `imap` (the company mail
 * server, opened with the Dovecot master user) and `memory` (fixtures for
 * tests and the sandbox). Unknown store names throw, like every other seam.
 *
 * Addresses, folders and UIDs are the IMAP identities; nothing here is
 * cached in the database — the server is the source of truth for mail.
 */
export type MailAddress = { name: string | null; address: string };

export type SpecialUse =
  | "inbox"
  | "sent"
  | "drafts"
  | "junk"
  | "trash"
  | "archive"
  | null;

export type MailFolder = {
  /** Server path, e.g. "INBOX" or "Tenders.2026". */
  path: string;
  /** Leaf name for display. */
  name: string;
  specialUse: SpecialUse;
  delimiter: string;
  total: number;
  unseen: number;
};

export type MailListItem = {
  uid: number;
  /** The folder this row lives in — matters when a list spans folders (Starred). */
  folder: string;
  subject: string;
  from: MailAddress | null;
  /** ISO date, best effort (header date, else internal date). */
  date: string | null;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  hasAttachments: boolean;
  size: number | null;
  /** First words of the body, one line, for the list. */
  preview: string;
};

export type MailAttachmentMeta = {
  /** Stable within a message: the index in the parsed attachment list. */
  index: number;
  filename: string;
  contentType: string;
  size: number;
  /** Content-ID for inline images (without the angle brackets). */
  cid: string | null;
  inline: boolean;
};

export type MailMessage = {
  uid: number;
  messageId: string | null;
  subject: string;
  from: MailAddress | null;
  to: MailAddress[];
  cc: MailAddress[];
  replyTo: MailAddress[];
  date: string | null;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  /** Raw HTML body (unsanitised — the service sanitises). */
  html: string | null;
  text: string | null;
  attachments: MailAttachmentMeta[];
  inReplyTo: string | null;
  references: string[];
};

export type MailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

export type ListOptions = {
  page: number;
  pageSize: number;
  /** Free-text search: subject, from, to and body on the server. */
  query?: string;
  /** Only unread. */
  unseenOnly?: boolean;
};

export type ListResult = {
  items: MailListItem[];
  total: number;
  page: number;
  pageSize: number;
};

/** What a live subscription reports: something in the folder changed. */
export type MailChange = {
  folder: string;
  /** New mail arrived / a message left / flags changed / the link broke. */
  kind: "exists" | "expunge" | "flags" | "error";
  detail?: string;
};

export type StarredOptions = {
  page: number;
  pageSize: number;
};

export type FlagPatch = {
  seen?: boolean;
  flagged?: boolean;
  answered?: boolean;
};

export class MailStoreError extends Error {
  constructor(
    public readonly code:
      | "not_configured"
      | "auth_failed"
      | "unavailable"
      | "not_found"
      | "too_large"
      | "exists"
      | "not_empty"
      | "invalid_name",
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "MailStoreError";
  }
}

export interface MailStore {
  readonly name: string;
  listFolders(address: string): Promise<MailFolder[]>;
  listMessages(
    address: string,
    folder: string,
    opts: ListOptions,
  ): Promise<ListResult>;
  /** Every starred message outside Junk/Trash, newest first, across folders. */
  listStarred(address: string, opts: StarredOptions): Promise<ListResult>;
  /** A new folder at the top level ("Tenders") or under a parent ("Tenders/2026"). */
  createFolder(address: string, path: string): Promise<MailFolder>;
  renameFolder(address: string, path: string, newPath: string): Promise<void>;
  /** Only an empty folder; the caller checks. */
  deleteFolder(address: string, path: string): Promise<void>;
  getMessage(
    address: string,
    folder: string,
    uid: number,
  ): Promise<MailMessage | null>;
  getAttachment(
    address: string,
    folder: string,
    uid: number,
    index: number,
  ): Promise<MailAttachment | null>;
  setFlags(
    address: string,
    folder: string,
    uids: number[],
    patch: FlagPatch,
  ): Promise<void>;
  /** Move to another folder path; the caller resolves "trash"/"archive". */
  move(
    address: string,
    folder: string,
    uids: number[],
    targetPath: string,
  ): Promise<void>;
  /** File a raw RFC 822 message (a sent copy) into a folder, flagged as given. */
  append(
    address: string,
    folder: string,
    raw: Buffer,
    flags: string[],
  ): Promise<void>;
  /**
   * Watch one folder for changes (IMAP IDLE on the server); resolves once the
   * watch is up, with a function that ends it. An "error" change means the
   * watch is over and the caller should reconnect.
   */
  subscribe(
    address: string,
    folder: string,
    onChange: (change: MailChange) => void,
  ): Promise<() => Promise<void>>;
}
