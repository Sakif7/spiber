import { simpleParser } from "mailparser";
import {
  MailStoreError,
  type FlagPatch,
  type ListOptions,
  type ListResult,
  type MailAttachment,
  type MailFolder,
  type MailMessage,
  type MailStore,
  type SpecialUse,
} from "./types";

/**
 * In-process mailboxes for tests and `dev:sandbox`: every address gets the
 * same small, deterministic set of folders and messages on first touch, and
 * flags/moves stick for the life of the process (on `globalThis`, so HMR
 * keeps them). No network, no parsing — the shapes the UI consumes directly.
 */
type StoredMessage = MailMessage & {
  folder: string;
  attachmentBlobs: MailAttachment[];
  internalDate: string;
};
type Box = {
  folders: { path: string; specialUse: SpecialUse }[];
  messages: StoredMessage[];
  nextUid: number;
};

declare global {
  var __mailStoreMemory: Map<string, Box> | undefined;
}

const table = (): Map<string, Box> =>
  (globalThis.__mailStoreMemory ??= new Map());

/** A 1×1 teal PNG, for the inline-image fixture. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function seed(address: string): Box {
  const local = address.split("@")[0];
  const at = (daysAgo: number, h = 9) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    d.setUTCHours(h, 12, 0, 0);
    return d.toISOString();
  };
  const me = { name: null, address };
  let uid = 100;
  const msg = (
    folder: string,
    over: Partial<StoredMessage> & {
      subject: string;
      from: MailMessage["from"];
    },
    daysAgo: number,
  ): StoredMessage => ({
    uid: uid++,
    messageId: `<fixture-${uid}@spibermed.test>`,
    to: [me],
    cc: [],
    replyTo: [],
    date: at(daysAgo),
    internalDate: at(daysAgo),
    seen: true,
    flagged: false,
    answered: false,
    html: null,
    text: null,
    attachments: [],
    attachmentBlobs: [],
    inReplyTo: null,
    references: [],
    folder,
    ...over,
  });

  const po = Buffer.from("%PDF-1.4\n% fixture purchase order\n", "utf8");
  const messages: StoredMessage[] = [
    msg(
      "INBOX",
      {
        subject: "Re: Quotation SPM-INV-000214 — pulse oximeters",
        from: {
          name: "Dr. Farhana Rahman",
          address: "farhana.rahman@squarehospital.example",
        },
        cc: [{ name: null, address: "sales@spibermed.com" }],
        seen: false,
        html: `<div style="font-family:Arial"><p>Dear Spiber Med team,</p><p>Thank you for the revised quotation. Please find the signed purchase order attached. Delivery by the 20th would be ideal for the ICU expansion.</p><p>Kindly confirm the AIT certificate will be issued with the invoice.</p><p><img src="cid:logo@square" alt="Square Hospital" width="1" height="1"> <img src="https://tracker.example/pixel.gif" alt=""></p><p>Best regards,<br>Dr. Farhana Rahman<br><span style="color:#666">Procurement, Square Hospital Ltd.</span></p><script>alert(1)</script><a href="javascript:alert(2)">click</a></div>`,
        text: "Dear Spiber Med team,\n\nThank you for the revised quotation. Please find the signed purchase order attached.",
        attachments: [
          {
            index: 0,
            filename: "PO-SQH-2026-0912.pdf",
            contentType: "application/pdf",
            size: po.length,
            cid: null,
            inline: false,
          },
          {
            index: 1,
            filename: "logo.png",
            contentType: "image/png",
            size: PNG.length,
            cid: "logo@square",
            inline: true,
          },
        ],
        attachmentBlobs: [
          {
            filename: "PO-SQH-2026-0912.pdf",
            contentType: "application/pdf",
            content: po,
          },
          { filename: "logo.png", contentType: "image/png", content: PNG },
        ],
      },
      0,
    ),
    msg(
      "INBOX",
      {
        subject: "September price list + IH 18 stock",
        from: { name: "Beurer Bangladesh", address: "orders@beurer.example" },
        seen: false,
        text: "Dear Spiber Med team, attached is the updated distributor price list effective 1 October.",
      },
      0,
    ),
    msg(
      "INBOX",
      {
        subject: "Tender BB/PROC/2026/118 — clarification round",
        from: {
          name: "Bangladesh Bank — Procurement",
          address: "procurement@bb.example",
        },
        seen: false,
        flagged: true,
        text: "All bidders are requested to submit clarifications by 18 September.",
      },
      1,
    ),
    msg(
      "INBOX",
      {
        subject: "Follow-up: Cloud EMR demo",
        from: { name: "MocDoc", address: "siva@mocdoc.example" },
        text: "Hi, following our call last week I wanted to share the pricing.",
        answered: true,
      },
      1,
    ),
    msg(
      "INBOX",
      {
        subject: "[spiber-vps] Backup completed",
        from: { name: "Coolify", address: "noreply@coolify.example" },
        text: "Daily backup of spibermed finished in 41 s (312 MB).",
      },
      2,
    ),
    msg(
      "INBOX",
      {
        subject: "Request for challan copy — order SPM-SO-000198",
        from: {
          name: "Labaid Diagnostic — Purchasing",
          address: "purchase@labaid.example",
        },
        text: "Could you resend the delivery challan for the ECG machines delivered on the 4th?",
      },
      2,
    ),
    msg(
      "INBOX",
      {
        subject: "Undelivered Mail Returned to Sender",
        from: {
          name: "Mail Delivery System",
          address: "MAILER-DAEMON@mail.spibermed.com",
        },
        text: "This is the mail system at host mail.spibermed.com. The recipient address was rejected.",
      },
      3,
    ),
    msg(
      "INBOX",
      {
        subject: "Your sender domain is verified",
        from: { name: "Brevo", address: "no-reply@brevo.example" },
        text: "spibermed.com has been verified for sending.",
      },
      3,
    ),
    msg(
      "Sent",
      {
        subject: "Quotation SPM-INV-000214 — pulse oximeters (revised)",
        from: me,
        to: [
          {
            name: "Dr. Farhana Rahman",
            address: "farhana.rahman@squarehospital.example",
          },
        ],
        text: "Dear Dr. Rahman, please find the revised quotation attached.",
      },
      1,
    ),
    msg(
      "Sent",
      {
        subject: `Introduction — ${local} at Spiber Med`,
        from: me,
        to: [
          {
            name: "Popular Diagnostic",
            address: "procurement@popular.example",
          },
        ],
        text: "Good morning, I look after Medtrade accounts and would like to arrange a visit.",
      },
      6,
    ),
    msg(
      "Junk",
      {
        subject: "Spiber Med online sales — guaranteed leads",
        from: {
          name: "Brooklyn Taylor",
          address: "brooklyn@wishpondproof.example",
        },
        seen: false,
        text: "We can 10x your online sales.",
      },
      5,
    ),
  ];
  // UIDs follow arrival order on a real server; make the fixture honest so
  // "newest first" means what the list claims (ties keep authoring order).
  const byDateDesc = [...messages].sort((a, b) =>
    b.internalDate.localeCompare(a.internalDate),
  );
  byDateDesc.forEach((m, i) => {
    m.uid = 100 + (byDateDesc.length - 1 - i);
  });
  return {
    folders: [
      { path: "INBOX", specialUse: "inbox" },
      { path: "Drafts", specialUse: "drafts" },
      { path: "Sent", specialUse: "sent" },
      { path: "Archive", specialUse: "archive" },
      { path: "Junk", specialUse: "junk" },
      { path: "Trash", specialUse: "trash" },
    ],
    messages,
    nextUid: 100 + messages.length,
  };
}

function box(address: string): Box {
  const t = table();
  let b = t.get(address);
  if (!b) {
    b = seed(address);
    t.set(address, b);
  }
  return b;
}

const strip = (m: StoredMessage): MailMessage => {
  const { folder: _f, attachmentBlobs: _b, internalDate: _d, ...rest } = m;
  void _f;
  void _b;
  void _d;
  return rest;
};

export const memoryMailStore: MailStore & { _reset(): void } = {
  name: "memory",

  async listFolders(address) {
    const b = box(address);
    return b.folders.map<MailFolder>((f) => {
      const inFolder = b.messages.filter((m) => m.folder === f.path);
      return {
        path: f.path,
        name: f.path === "INBOX" ? "Inbox" : f.path,
        specialUse: f.specialUse,
        delimiter: ".",
        total: inFolder.length,
        unseen: inFolder.filter((m) => !m.seen).length,
      };
    });
  },

  async listMessages(address, folder, opts: ListOptions): Promise<ListResult> {
    const b = box(address);
    if (!b.folders.some((f) => f.path === folder)) {
      throw new MailStoreError("not_found", folder);
    }
    const q = opts.query?.trim().toLowerCase();
    let rows = b.messages.filter((m) => m.folder === folder);
    if (q) {
      rows = rows.filter((m) =>
        [
          m.subject,
          m.from?.name,
          m.from?.address,
          m.text,
          ...m.to.map((t) => t.address),
        ]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q)),
      );
    }
    if (opts.unseenOnly) rows = rows.filter((m) => !m.seen);
    rows.sort((a, c) => c.uid - a.uid);
    const start = (opts.page - 1) * opts.pageSize;
    return {
      items: rows.slice(start, start + opts.pageSize).map((m) => ({
        uid: m.uid,
        subject: m.subject,
        from: m.from,
        date: m.date,
        seen: m.seen,
        flagged: m.flagged,
        answered: m.answered,
        hasAttachments: m.attachments.some((a) => !a.inline),
        size: (m.text?.length ?? 0) + (m.html?.length ?? 0),
      })),
      total: rows.length,
      page: opts.page,
      pageSize: opts.pageSize,
    };
  },

  async getMessage(address, folder, uid) {
    const m = box(address).messages.find(
      (x) => x.folder === folder && x.uid === uid,
    );
    return m ? strip(m) : null;
  },

  async getAttachment(address, folder, uid, index) {
    const m = box(address).messages.find(
      (x) => x.folder === folder && x.uid === uid,
    );
    return m?.attachmentBlobs[index] ?? null;
  },

  async setFlags(address, folder, uids, patch: FlagPatch) {
    for (const m of box(address).messages) {
      if (m.folder !== folder || !uids.includes(m.uid)) continue;
      if (patch.seen !== undefined) m.seen = patch.seen;
      if (patch.flagged !== undefined) m.flagged = patch.flagged;
      if (patch.answered !== undefined) m.answered = patch.answered;
    }
  },

  async append(address, folder, raw, flags) {
    const b = box(address);
    if (!b.folders.some((f) => f.path === folder)) {
      throw new MailStoreError("not_found", folder);
    }
    const mail = await simpleParser(raw);
    const one = (v: unknown) => {
      const list = Array.isArray(v) ? v : v ? [v] : [];
      return (
        list as { value?: { name?: string; address?: string }[] }[]
      ).flatMap((o) =>
        (o.value ?? [])
          .filter((x) => x.address)
          .map((x) => ({ name: x.name?.trim() || null, address: x.address! })),
      );
    };
    const now = new Date().toISOString();
    b.messages.push({
      uid: b.nextUid++,
      messageId: mail.messageId ?? null,
      subject: mail.subject?.trim() || "(no subject)",
      from: one(mail.from)[0] ?? null,
      to: one(mail.to),
      cc: one(mail.cc),
      replyTo: one(mail.replyTo),
      date: now,
      internalDate: now,
      seen: flags.includes("\\Seen"),
      flagged: flags.includes("\\Flagged"),
      answered: false,
      html: typeof mail.html === "string" ? mail.html : null,
      text: mail.text ?? null,
      attachments: (mail.attachments ?? []).map((a, index) => ({
        index,
        filename: a.filename || `attachment-${index + 1}`,
        contentType: a.contentType || "application/octet-stream",
        size: a.size ?? a.content?.length ?? 0,
        cid: a.cid ?? null,
        inline: a.contentDisposition === "inline",
      })),
      attachmentBlobs: (mail.attachments ?? []).map((a, index) => ({
        filename: a.filename || `attachment-${index + 1}`,
        contentType: a.contentType || "application/octet-stream",
        content: a.content,
      })),
      inReplyTo: mail.inReplyTo ?? null,
      references: mail.references
        ? Array.isArray(mail.references)
          ? mail.references
          : [mail.references]
        : [],
      folder,
    });
  },

  async move(address, folder, uids, targetPath) {
    const b = box(address);
    if (!b.folders.some((f) => f.path === targetPath)) {
      throw new MailStoreError("not_found", targetPath);
    }
    for (const m of b.messages) {
      if (m.folder === folder && uids.includes(m.uid)) m.folder = targetPath;
    }
  },

  _reset() {
    table().clear();
  },
};
