import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  AuthoredDocument,
  type IAuthoredDocument,
  type IDocumentRecipient,
} from "@/lib/models/authored-document";
import { Employee, type IEmployee } from "@/lib/models/employee";
import type { Lean } from "@/lib/models/_shared";
import type { EmployeeSession } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { getCompanyDocumentById } from "@/lib/repositories/company-documents.repo";
import { readDocumentBytes } from "@/lib/services/company-fs.service";
import { auditDocumentView } from "@/lib/audit/document-view";
import { loadAsset } from "@/lib/services/pdf-asset.service";
import { notifyAdmins, notifyUsers } from "@/lib/services/notification.service";
import { getMailer } from "@/lib/mailer";
import { renderEmail } from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { logger } from "@/lib/log";
import { DOCUMENT_TYPE_LABEL } from "@/lib/documents/types";
import {
  slotsIn,
  withSignatures,
  type SlotSignature,
} from "@/lib/documents/render";
import type { DocumentBody } from "@/lib/schemas/authored-document";
import {
  fileVersion,
  getDocument,
  nextDocumentNumber,
  type Actor,
  type DocumentResult,
  type DocumentRow,
} from "./authored-document.service";

/**
 * Sending and signing.
 *
 * Send: the document gets its number, locks, files its "sent" PDF in the
 * vault and goes to its recipients — the people whose signature slots it
 * carries (they sign) plus anyone the author adds to read it (they
 * acknowledge). Each is told in their portal bell and by mail to their
 * company address.
 *
 * Acknowledge: the person types their name and ticks the box; a signer's
 * stored signature is placed into their slot. The asset id is frozen on the
 * recipient row, so a signature replaced later never changes a document
 * already signed. When the last recipient has acted, the document completes
 * and the signed PDF is filed as the final version.
 */
const oid = (id: string) => new mongoose.Types.ObjectId(id);

const when = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });

function event(actor: { sub: string } | null, action: string, note?: string) {
  return {
    at: new Date(),
    actorId: actor ? oid(actor.sub) : null,
    action,
    note: note ?? null,
  };
}

/** The signatures already given, ready to draw: image as a data URI. */
export async function signedBodyFor(
  doc: Pick<DocumentRow, "body" | "recipients">,
  imageFor: "print" | "screen" = "print",
): Promise<DocumentBody> {
  const signed = new Map<string, SlotSignature>();
  for (const r of doc.recipients ?? []) {
    if (r.status !== "signed" || !r.signatureAssetId || !r.actedAt) continue;
    const line = `Signed ${when(new Date(r.actedAt))}`;
    if (imageFor === "screen") {
      signed.set(String(r.employeeId), {
        image: `/api/media/signature/${String(r.employeeId)}?a=${String(r.signatureAssetId)}`,
        line,
      });
      continue;
    }
    const asset = await loadAsset(String(r.signatureAssetId));
    if (!asset) continue;
    signed.set(String(r.employeeId), {
      image: `data:image/png;base64,${asset.data.toString("base64")}`,
      line,
    });
  }
  return withSignatures(doc.body, signed);
}

export type SendInput = {
  /** Extra people who only need to read it (the slots' people sign). */
  acknowledgers?: string[];
  /** A line for the notification mail. */
  message?: string;
};

export type SendOutcome = {
  number: string;
  status: "sent" | "completed";
  recipients: {
    employeeId: string;
    name: string;
    role: "sign" | "acknowledge";
  }[];
  version: number;
};

export async function sendDocument(
  id: string,
  input: SendInput,
  actor: Actor,
  req?: Request,
): Promise<DocumentResult<SendOutcome>> {
  const doc = await getDocument(id);
  if (!doc) return { ok: false, code: "not_found" };
  if (doc.status !== "draft" && doc.status !== "in_review") {
    return { ok: false, code: "locked" };
  }
  await connectToDatabase();

  // Who it goes to: one row per person, signers first.
  const slots = slotsIn(doc.body);
  const wanted = new Map<string, "sign" | "acknowledge">();
  for (const s of slots) {
    if (mongoose.isValidObjectId(s.employeeId))
      wanted.set(s.employeeId, "sign");
  }
  for (const e of input.acknowledgers ?? []) {
    if (mongoose.isValidObjectId(e) && !wanted.has(e))
      wanted.set(e, "acknowledge");
  }
  const people = wanted.size
    ? await Employee.find({
        _id: { $in: [...wanted.keys()].map(oid) },
        deletedAt: null,
        status: "active",
      })
        .lean<Lean<IEmployee>[]>()
        .exec()
    : [];
  const missing = [...wanted.keys()].filter(
    (k) => !people.some((p) => String(p._id) === k),
  );
  if (missing.length) {
    return {
      ok: false,
      code: "invalid_input",
      detail: `no active employee for ${missing.join(", ")}`,
    };
  }
  const recipients: IDocumentRecipient[] = people.map((p) => ({
    employeeId: p._id,
    role: wanted.get(String(p._id)) ?? "acknowledge",
    status: "pending",
  }));

  // The number is taken only once the document really goes.
  const number = doc.number ?? (await nextDocumentNumber(doc.type));
  const status: "sent" | "completed" = recipients.length ? "sent" : "completed";
  const now = new Date();
  const updated = await AuthoredDocument.findOneAndUpdate(
    { _id: oid(id), status: { $in: ["draft", "in_review"] } },
    {
      $set: {
        number,
        status,
        sentAt: now,
        completedAt: status === "completed" ? now : null,
        recipients,
      },
      $inc: { rev: 1 },
      $push: {
        activity: event(
          actor,
          "document.send",
          recipients.length
            ? `to ${people.map((p) => p.name).join(", ")}`
            : "no recipients — filed as final",
        ),
      },
    },
    { returnDocument: "after" },
  )
    .lean<DocumentRow>()
    .exec();
  if (!updated) return { ok: false, code: "stale" };

  // The "sent" PDF: what everyone was asked to sign. Filed before anyone
  // is told, so the mail can point at something that exists.
  const filed = await fileVersion(
    id,
    status === "completed" ? "completed" : "sent",
    actor,
    {
      req,
      printBody: await signedBodyFor(updated),
    },
  );
  if (!filed.ok) {
    logger.warn("document send: version not filed", { id, code: filed.code });
  }

  await writeAudit(
    {
      actorId: actor.sub,
      action: "document.send",
      entityType: "AuthoredDocument",
      entityId: id,
      after: {
        number,
        status,
        recipients: recipients.map((r) => ({
          employeeId: String(r.employeeId),
          role: r.role,
        })),
      },
    },
    req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));

  // Tell each person: the bell in their portal, and mail to their company
  // address. Best effort — a mail that does not go never un-sends a notice.
  const kind = DOCUMENT_TYPE_LABEL[doc.type].toLowerCase();
  const href = `/admin/me/documents/${id}`;
  await Promise.allSettled(
    people.map(async (p) => {
      const role = wanted.get(String(p._id));
      const ask =
        role === "sign" ? "needs your signature" : "is for you to read";
      if (p.userId) {
        await notifyUsers([String(p.userId)], {
          type: role === "sign" ? "document.sign" : "document.read",
          title: `${DOCUMENT_TYPE_LABEL[doc.type]} ${number} ${ask}`,
          body: doc.title,
          href,
          severity: "info",
          entity: { kind: "authoredDocument", id, ref: number },
        });
      }
      const to = p.businessEmail || p.email;
      if (!to) return;
      const mail = renderEmail({
        accent: "teal",
        preheader: `${DOCUMENT_TYPE_LABEL[doc.type]} ${number}: ${doc.title}`,
        eyebrow: DOCUMENT_TYPE_LABEL[doc.type],
        heading: doc.title,
        greetingName: p.name,
        paragraphs: [
          `A ${kind} from ${siteConfig.brand} ${ask}. Open it in your portal, read it, and ${
            role === "sign"
              ? "acknowledge it with your signature"
              : "acknowledge that you have read it"
          }.`,
          ...(input.message?.trim() ? [input.message.trim()] : []),
        ],
        button: {
          label: role === "sign" ? "Read and sign" : "Read it",
          url: `${siteConfig.url}/en${href}`,
        },
        outro: [`Reference ${number}.`],
      });
      await getMailer().send({
        to,
        subject: `${DOCUMENT_TYPE_LABEL[doc.type]} ${number}: ${doc.title}`,
        html: mail.html,
        text: mail.text,
        attachments: mail.attachments,
      });
    }),
  ).then((results) => {
    for (const r of results)
      if (r.status === "rejected")
        logger.warn("document send: notification failed", {
          id,
          error: String(r.reason),
        });
  });

  return {
    ok: true,
    data: {
      number,
      status,
      recipients: people.map((p) => ({
        employeeId: String(p._id),
        name: p.name,
        role: wanted.get(String(p._id)) ?? "acknowledge",
      })),
      version: filed.ok ? filed.data.version : 0,
    },
  };
}

// ───────────────────────────── the recipient's side ─────────────────────────────

export type MyDocumentRow = {
  id: string;
  number: string | null;
  title: string;
  type: IAuthoredDocument["type"];
  status: IAuthoredDocument["status"];
  sentAt: Date | null;
  me: {
    role: "sign" | "acknowledge";
    status: IDocumentRecipient["status"];
    actedAt: Date | null;
  };
  others: {
    name: string;
    role: "sign" | "acknowledge";
    status: IDocumentRecipient["status"];
  }[];
  /** The latest filed version — what the person reads. */
  version: number | null;
};

const normaliseName = (s: string) =>
  s.trim().replace(/\s+/g, " ").toLowerCase();

async function rowFor(
  doc: DocumentRow,
  employeeId: string,
): Promise<MyDocumentRow | null> {
  const me = (doc.recipients ?? []).find(
    (r) => String(r.employeeId) === employeeId,
  );
  if (!me) return null;
  const otherIds = (doc.recipients ?? [])
    .map((r) => String(r.employeeId))
    .filter((e) => e !== employeeId);
  const names = otherIds.length
    ? await Employee.find({ _id: { $in: otherIds.map(oid) } })
        .select("name")
        .lean<Pick<Lean<IEmployee>, "_id" | "name">[]>()
        .exec()
    : [];
  const nameOf = new Map(names.map((n) => [String(n._id), n.name]));
  const latest = [...(doc.versions ?? [])].filter((v) => v.vaultFileId).pop();
  return {
    id: String(doc._id),
    number: doc.number ?? null,
    title: doc.title,
    type: doc.type,
    status: doc.status,
    sentAt: doc.sentAt ?? null,
    me: { role: me.role, status: me.status, actedAt: me.actedAt ?? null },
    others: (doc.recipients ?? [])
      .filter((r) => String(r.employeeId) !== employeeId)
      .map((r) => ({
        name: nameOf.get(String(r.employeeId)) ?? "Colleague",
        role: r.role,
        status: r.status,
      })),
    version: latest?.n ?? null,
  };
}

/** Everything sent to this person, pending first, newest first within. */
export async function myDocuments(
  session: EmployeeSession,
): Promise<MyDocumentRow[]> {
  await connectToDatabase();
  const employeeId = String(session.employee._id);
  const docs = await AuthoredDocument.find({
    deletedAt: null,
    status: { $in: ["sent", "completed"] },
    "recipients.employeeId": oid(employeeId),
  })
    .sort({ sentAt: -1 })
    .lean<DocumentRow[]>()
    .exec();
  const rows = (
    await Promise.all(docs.map((d) => rowFor(d, employeeId)))
  ).filter((r): r is MyDocumentRow => r !== null);
  return rows.sort(
    (a, b) =>
      Number(a.me.status !== "pending") - Number(b.me.status !== "pending") ||
      (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0),
  );
}

export async function myDocument(
  session: EmployeeSession,
  id: string,
): Promise<MyDocumentRow | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await getDocument(id);
  if (!doc || (doc.status !== "sent" && doc.status !== "completed"))
    return null;
  return rowFor(doc, String(session.employee._id));
}

/** The latest filed PDF, for a recipient — audited like any vault view. */
export async function myDocumentPdf(
  session: EmployeeSession,
  id: string,
  req?: Request,
): Promise<{ bytes: Buffer; filename: string } | null> {
  const row = await myDocument(session, id);
  if (!row || !row.version) return null;
  const doc = await getDocument(id);
  const version = doc?.versions?.find((v) => v.n === row.version);
  if (!doc || !version?.vaultFileId) return null;
  const file = await getCompanyDocumentById(String(version.vaultFileId));
  if (!file) return null;
  const bytes = await readDocumentBytes(file);
  if (!bytes) return null;
  await auditDocumentView({
    actorId: session.claims.sub,
    action: "document.version.view",
    entityType: "AuthoredDocument",
    entityId: id,
    after: { version: version.n, title: file.title, recipient: true },
    req,
  }).catch(() => undefined);
  return { bytes, filename: file.title };
}

export type AcknowledgeError =
  | "not_found"
  | "not_pending"
  | "name_mismatch"
  | "no_signature"
  | "print_failed"
  | "vault_failed";

/**
 * The person's act: their name typed as on their record, the box ticked.
 * A signer's current signature is placed into their slot and its asset id
 * frozen on the row. When everyone has acted, the document completes.
 */
export async function acknowledgeDocument(
  session: EmployeeSession,
  id: string,
  input: { typedName: string; ip?: string | null },
  req?: Request,
): Promise<
  | {
      ok: true;
      data: { status: "signed" | "acknowledged"; completed: boolean };
    }
  | { ok: false; code: AcknowledgeError; detail?: string }
> {
  if (!mongoose.isValidObjectId(id)) return { ok: false, code: "not_found" };
  const employee = session.employee;
  const employeeId = String(employee._id);
  const doc = await getDocument(id);
  if (!doc || doc.status !== "sent") return { ok: false, code: "not_found" };
  const me = (doc.recipients ?? []).find(
    (r) => String(r.employeeId) === employeeId,
  );
  if (!me) return { ok: false, code: "not_found" };
  if (me.status !== "pending") return { ok: false, code: "not_pending" };
  if (normaliseName(input.typedName) !== normaliseName(employee.name)) {
    return { ok: false, code: "name_mismatch" };
  }
  const signing = me.role === "sign";
  if (signing && !employee.signatureAssetId) {
    return { ok: false, code: "no_signature" };
  }

  const now = new Date();
  const newStatus: IDocumentRecipient["status"] = signing
    ? "signed"
    : "acknowledged";
  const actor = { sub: session.claims.sub, email: session.claims.email };
  await connectToDatabase();
  // One atomic update on the pending row: a double submit cannot sign twice.
  const updated = await AuthoredDocument.findOneAndUpdate(
    {
      _id: oid(id),
      status: "sent",
      recipients: {
        $elemMatch: { employeeId: oid(employeeId), status: "pending" },
      },
    },
    {
      $set: {
        "recipients.$.status": newStatus,
        "recipients.$.actedAt": now,
        "recipients.$.signatureAssetId": signing
          ? oid(String(employee.signatureAssetId))
          : null,
        "recipients.$.typedName": input.typedName.trim(),
        "recipients.$.ip": input.ip ?? null,
      },
      $push: {
        activity: event(
          actor,
          signing ? "document.signed" : "document.acknowledged",
          employee.name,
        ),
      },
    },
    { returnDocument: "after" },
  )
    .lean<DocumentRow>()
    .exec();
  if (!updated) return { ok: false, code: "not_pending" };

  const allDone = (updated.recipients ?? []).every(
    (r) => r.status !== "pending",
  );
  await writeAudit(
    {
      actorId: actor.sub,
      action: signing ? "document.signed" : "document.acknowledged",
      entityType: "AuthoredDocument",
      entityId: id,
      after: {
        employeeId,
        typedName: input.typedName.trim(),
        completed: allDone,
      },
    },
    req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));

  let completed = false;
  if (allDone) {
    // The final PDF carries every signature; only then does the document
    // complete — a completed document always has its signed copy filed.
    const filed = await fileVersion(id, "completed", actor, {
      req,
      printBody: await signedBodyFor(updated),
      note: `signed by ${employee.name}`,
    });
    if (!filed.ok) {
      logger.warn("document complete: version not filed", {
        id,
        code: filed.code,
      });
      return {
        ok: false,
        code: filed.code === "print_failed" ? "print_failed" : "vault_failed",
        detail: filed.detail,
      };
    }
    await AuthoredDocument.updateOne(
      { _id: oid(id), status: "sent" },
      {
        $set: { status: "completed", completedAt: new Date() },
        $push: { activity: event(null, "document.completed") },
      },
    ).exec();
    completed = true;
  }

  await notifyAdmins({
    type: completed
      ? "document.completed"
      : signing
        ? "document.signed"
        : "document.acknowledged",
    title: completed
      ? `${DOCUMENT_TYPE_LABEL[updated.type]} ${updated.number} is complete`
      : `${employee.name} ${signing ? "signed" : "acknowledged"} ${updated.number}`,
    body: updated.title,
    href: `/admin/company/documents/${id}`,
    severity: completed ? "success" : "info",
    entity: { kind: "authoredDocument", id, ref: updated.number ?? undefined },
  });

  return { ok: true, data: { status: newStatus, completed } };
}
