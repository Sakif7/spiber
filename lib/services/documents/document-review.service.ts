import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  AuthoredDocument,
  type IDocumentComment,
  type IDocumentReviewer,
} from "@/lib/models/authored-document";
import { Employee, type IEmployee } from "@/lib/models/employee";
import { User } from "@/lib/models/user";
import type { Lean } from "@/lib/models/_shared";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { notifyUsers } from "@/lib/services/notification.service";
import { getMailer } from "@/lib/mailer";
import { renderEmail } from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { logger } from "@/lib/log";
import {
  DOCUMENT_TYPE_LABEL,
  type DocumentStatus,
} from "@/lib/documents/types";
import type {
  AddCommentInput,
  DocumentBody,
  DocumentSettings,
  RequestReviewInput,
} from "@/lib/schemas/authored-document";
import { documentSettingsSchema } from "@/lib/schemas/authored-document";
import { mergeValuesFor } from "./document-signing.service";
import {
  getDocument,
  type Actor,
  type DocumentResult,
  type DocumentRow,
} from "./authored-document.service";

/**
 * Review: the author asks directors (or anyone with a login) to read the
 * draft; they and any admin leave comments on the words they select; the
 * author answers and resolves; a reviewer says when they are done. A
 * comment never touches the body — it is anchored by the words it quotes
 * (`lib/documents/anchors.ts`) — so the author keeps typing meanwhile and
 * nothing has to be stripped before printing.
 *
 * Two doors, one room: the super admin acts through the document routes,
 * a reviewer through `/api/admin/me/reviews/*`; both land here with a
 * `ReviewActor`, and `canReview` decides.
 */
export type ReviewActor = {
  sub: string;
  /** Any admin may read and comment on a document that is in review. */
  isAdmin: boolean;
};

const oid = (id: string) => new mongoose.Types.ObjectId(id);
const OPEN: DocumentStatus[] = ["draft", "in_review"];

export type CommentView = {
  id: string;
  quote: string;
  prefix: string;
  suffix: string;
  at: number;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  replies: {
    authorId: string;
    authorName: string;
    text: string;
    createdAt: string;
  }[];
  resolvedAt: string | null;
};

export type ReviewerView = {
  userId: string;
  employeeId: string | null;
  name: string;
  status: "pending" | "done";
  invitedAt: string;
  actedAt: string | null;
};

/** What both surfaces show: the threads, and who was asked. */
export type ReviewState = {
  status: DocumentStatus;
  comments: CommentView[];
  reviewers: ReviewerView[];
};

export function reviewStateOf(
  doc: Pick<DocumentRow, "status" | "comments" | "reviewers">,
): ReviewState {
  return {
    status: doc.status,
    comments: (doc.comments ?? []).map((c) => ({
      id: c.id,
      quote: c.quote ?? "",
      prefix: c.prefix ?? "",
      suffix: c.suffix ?? "",
      at: c.at ?? 0,
      authorId: String(c.authorId),
      authorName: c.authorName ?? "Someone",
      text: c.text,
      createdAt: new Date(c.createdAt).toISOString(),
      replies: (c.replies ?? []).map((r) => ({
        authorId: String(r.authorId),
        authorName: r.authorName ?? "Someone",
        text: r.text,
        createdAt: new Date(r.createdAt).toISOString(),
      })),
      resolvedAt: c.resolvedAt ? new Date(c.resolvedAt).toISOString() : null,
    })),
    reviewers: (doc.reviewers ?? []).map((r) => ({
      userId: String(r.userId),
      employeeId: r.employeeId ? String(r.employeeId) : null,
      name: r.name,
      status: r.status,
      invitedAt: new Date(r.invitedAt).toISOString(),
      actedAt: r.actedAt ? new Date(r.actedAt).toISOString() : null,
    })),
  };
}

export function canReview(
  doc: Pick<DocumentRow, "reviewers">,
  actor: ReviewActor,
): boolean {
  return (
    actor.isAdmin ||
    (doc.reviewers ?? []).some((r) => String(r.userId) === actor.sub)
  );
}

/** The name a comment is signed with: the employee record's, else the login's. */
async function displayNameFor(userId: string): Promise<string> {
  if (!mongoose.isValidObjectId(userId)) return "Someone";
  const employee = await Employee.findOne({
    userId: oid(userId),
    deletedAt: null,
  })
    .select("name")
    .lean<{ name: string }>()
    .exec();
  if (employee?.name) return employee.name;
  const user = await User.findById(userId)
    .select("name email")
    .lean<{ name?: string; email?: string }>()
    .exec();
  return user?.name || user?.email || "Someone";
}

function event(actor: { sub: string }, action: string, note?: string) {
  return {
    at: new Date(),
    actorId: oid(actor.sub),
    action,
    note: note ?? null,
  };
}

const audit = (entry: Parameters<typeof writeAudit>[0], req?: Request) =>
  writeAudit(entry, req).catch((e) =>
    logger.warn("audit failed", { error: String(e) }),
  );

/** Everyone in the conversation but the one acting. */
function participants(doc: DocumentRow, except: string): string[] {
  const ids = new Set<string>([String(doc.authorId)]);
  for (const r of doc.reviewers ?? []) ids.add(String(r.userId));
  for (const c of doc.comments ?? []) {
    ids.add(String(c.authorId));
    for (const r of c.replies ?? []) ids.add(String(r.authorId));
  }
  ids.delete(except);
  return [...ids];
}

const snippet = (s: string, n = 80) =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

// ───────────────────────────── the author's side ─────────────────────────────

/**
 * Ask people to review. Each gets the bell and a mail; someone asked again
 * goes back to "pending". The body's revision is untouched — a review is
 * not an edit, and the author's open editor must not go stale over it.
 */
export async function requestReview(
  id: string,
  input: RequestReviewInput,
  actor: Actor,
  req?: Request,
): Promise<DocumentResult<ReviewState>> {
  const doc = await getDocument(id);
  if (!doc) return { ok: false, code: "not_found" };
  if (!OPEN.includes(doc.status)) return { ok: false, code: "locked" };
  await connectToDatabase();

  const people = await Employee.find({
    _id: { $in: input.reviewers.map(oid) },
    deletedAt: null,
    status: "active",
  })
    .lean<Lean<IEmployee>[]>()
    .exec();
  const missing = input.reviewers.filter(
    (r) => !people.some((p) => String(p._id) === r),
  );
  if (missing.length) {
    return {
      ok: false,
      code: "invalid_input",
      detail: `no active employee for ${missing.join(", ")}`,
    };
  }
  const noLogin = people.filter((p) => !p.userId);
  if (noLogin.length) {
    return {
      ok: false,
      code: "invalid_input",
      detail: `${noLogin.map((p) => p.name).join(", ")} cannot sign in yet`,
    };
  }

  const now = new Date();
  const reviewers: IDocumentReviewer[] = [...(doc.reviewers ?? [])];
  for (const p of people) {
    const userId = String(p.userId);
    const i = reviewers.findIndex((r) => String(r.userId) === userId);
    const row: IDocumentReviewer = {
      userId: oid(userId),
      employeeId: p._id,
      name: p.name,
      status: "pending",
      invitedAt: now,
      actedAt: null,
    };
    if (i === -1) reviewers.push(row);
    else reviewers[i] = row;
  }
  const updated = await AuthoredDocument.findOneAndUpdate(
    { _id: oid(id), status: { $in: OPEN } },
    {
      $set: { status: "in_review", reviewers },
      $push: {
        activity: event(
          actor,
          "document.review_request",
          people.map((p) => p.name).join(", "),
        ),
      },
    },
    { returnDocument: "after" },
  )
    .lean<DocumentRow>()
    .exec();
  if (!updated) return { ok: false, code: "stale" };

  await audit(
    {
      actorId: actor.sub,
      action: "document.review_request",
      entityType: "AuthoredDocument",
      entityId: id,
      after: { reviewers: people.map((p) => String(p._id)) },
    },
    req,
  );

  const kind = DOCUMENT_TYPE_LABEL[doc.type];
  const href = `/admin/me/reviews/${id}`;
  await Promise.allSettled(
    people.map(async (p) => {
      await notifyUsers([String(p.userId)], {
        type: "document.review",
        title: `Please review: ${doc.title}`,
        body: `${kind} draft`,
        href,
        severity: "info",
        entity: { kind: "authoredDocument", id, ref: doc.number ?? undefined },
      });
      const to = p.businessEmail || p.email;
      if (!to) return;
      const mail = renderEmail({
        accent: "teal",
        preheader: `Please review: ${doc.title}`,
        eyebrow: `${kind} for review`,
        heading: doc.title,
        greetingName: p.name,
        paragraphs: [
          `A ${kind.toLowerCase()} from ${siteConfig.brand} is waiting for your eyes. Open it in your portal, select any words you have something to say about, and comment. Say "Finish review" when you are done.`,
          ...(input.message?.trim() ? [input.message.trim()] : []),
        ],
        button: { label: "Review it", url: `${siteConfig.url}/en${href}` },
      });
      await getMailer().send({
        to,
        subject: `Please review: ${doc.title}`,
        html: mail.html,
        text: mail.text,
        attachments: mail.attachments,
      });
    }),
  ).then((results) => {
    for (const r of results)
      if (r.status === "rejected")
        logger.warn("review request: notification failed", {
          id,
          error: String(r.reason),
        });
  });

  return { ok: true, data: reviewStateOf(updated) };
}

/** Only the author's side may close a thread. */
export async function resolveComment(
  id: string,
  commentId: string,
  resolved: boolean,
  actor: Actor,
  req?: Request,
): Promise<DocumentResult<ReviewState>> {
  const doc = await getDocument(id);
  if (!doc) return { ok: false, code: "not_found" };
  const comment = (doc.comments ?? []).find((c) => c.id === commentId);
  if (!comment) return { ok: false, code: "not_found" };
  await connectToDatabase();
  const updated = await AuthoredDocument.findOneAndUpdate(
    { _id: oid(id), "comments.id": commentId },
    {
      $set: {
        "comments.$.resolvedAt": resolved ? new Date() : null,
        "comments.$.resolvedBy": resolved ? oid(actor.sub) : null,
      },
    },
    { returnDocument: "after" },
  )
    .lean<DocumentRow>()
    .exec();
  if (!updated) return { ok: false, code: "stale" };
  await audit(
    {
      actorId: actor.sub,
      action: resolved ? "document.comment.resolve" : "document.comment.reopen",
      entityType: "AuthoredDocument",
      entityId: id,
      after: { commentId },
    },
    req,
  );
  return { ok: true, data: reviewStateOf(updated) };
}

// ───────────────────────────── both sides ─────────────────────────────

/**
 * A new thread. `via` says which door the actor came through: the author's
 * routes are already super-admin only; a reviewer must be on the list (or
 * an admin). Everyone else in the conversation is told.
 */
export async function addComment(
  id: string,
  input: AddCommentInput,
  actor: ReviewActor,
  via: "author" | "reviewer",
  req?: Request,
): Promise<DocumentResult<ReviewState>> {
  const doc = await getDocument(id);
  if (!doc) return { ok: false, code: "not_found" };
  if (via === "reviewer" && !canReview(doc, actor))
    return { ok: false, code: "not_found" };
  if (!OPEN.includes(doc.status)) return { ok: false, code: "locked" };
  await connectToDatabase();

  const comment: IDocumentComment = {
    id: String(new mongoose.Types.ObjectId()),
    quote: input.quote,
    prefix: input.prefix,
    suffix: input.suffix,
    at: input.at,
    authorId: oid(actor.sub),
    authorName: await displayNameFor(actor.sub),
    text: input.text,
    createdAt: new Date(),
    replies: [],
    resolvedAt: null,
    resolvedBy: null,
  };
  const updated = await AuthoredDocument.findOneAndUpdate(
    { _id: oid(id), status: { $in: OPEN } },
    {
      $push: {
        comments: comment,
        activity: event(actor, "document.comment", snippet(input.text)),
      },
    },
    { returnDocument: "after" },
  )
    .lean<DocumentRow>()
    .exec();
  if (!updated) return { ok: false, code: "stale" };

  await audit(
    {
      actorId: actor.sub,
      action: "document.comment",
      entityType: "AuthoredDocument",
      entityId: id,
      after: { commentId: comment.id, quote: snippet(input.quote, 120) },
    },
    req,
  );
  await notifyUsers(participants(updated, actor.sub), {
    type: "document.comment",
    title: `${comment.authorName} commented on ${doc.title}`,
    body: snippet(input.text, 140),
    href:
      via === "reviewer"
        ? `/admin/company/documents/${id}/edit`
        : `/admin/me/reviews/${id}`,
    severity: "info",
    entity: { kind: "authoredDocument", id, ref: doc.number ?? undefined },
  });
  return { ok: true, data: reviewStateOf(updated) };
}

export async function replyToComment(
  id: string,
  commentId: string,
  text: string,
  actor: ReviewActor,
  via: "author" | "reviewer",
  req?: Request,
): Promise<DocumentResult<ReviewState>> {
  const doc = await getDocument(id);
  if (!doc) return { ok: false, code: "not_found" };
  if (via === "reviewer" && !canReview(doc, actor))
    return { ok: false, code: "not_found" };
  if (!(doc.comments ?? []).some((c) => c.id === commentId))
    return { ok: false, code: "not_found" };
  if (!OPEN.includes(doc.status)) return { ok: false, code: "locked" };
  await connectToDatabase();

  const reply = {
    authorId: oid(actor.sub),
    authorName: await displayNameFor(actor.sub),
    text,
    createdAt: new Date(),
  };
  const updated = await AuthoredDocument.findOneAndUpdate(
    { _id: oid(id), "comments.id": commentId, status: { $in: OPEN } },
    {
      $push: {
        "comments.$.replies": reply,
        activity: event(actor, "document.comment.reply", snippet(text)),
      },
    },
    { returnDocument: "after" },
  )
    .lean<DocumentRow>()
    .exec();
  if (!updated) return { ok: false, code: "stale" };
  await audit(
    {
      actorId: actor.sub,
      action: "document.comment.reply",
      entityType: "AuthoredDocument",
      entityId: id,
      after: { commentId },
    },
    req,
  );
  await notifyUsers(participants(updated, actor.sub), {
    type: "document.comment",
    title: `${reply.authorName} replied on ${doc.title}`,
    body: snippet(text, 140),
    href:
      via === "reviewer"
        ? `/admin/company/documents/${id}/edit`
        : `/admin/me/reviews/${id}`,
    severity: "info",
    entity: { kind: "authoredDocument", id, ref: doc.number ?? undefined },
  });
  return { ok: true, data: reviewStateOf(updated) };
}

// ───────────────────────────── the reviewer's side ─────────────────────────────

export type ReviewRow = {
  id: string;
  title: string;
  type: DocumentRow["type"];
  number: string | null;
  status: DocumentStatus;
  authorName: string;
  invitedAt: string | null;
  /** This person's row; null for an admin who was not asked by name. */
  me: ReviewerView | null;
  open: number;
  updatedAt: string;
};

/** Documents this person may review: asked by name, or (an admin) in review. */
export async function myReviews(actor: ReviewActor): Promise<ReviewRow[]> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(actor.sub)) return [];
  const docs = await AuthoredDocument.find({
    deletedAt: null,
    $or: [
      { "reviewers.userId": oid(actor.sub) },
      ...(actor.isAdmin ? [{ status: "in_review" as const }] : []),
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean<DocumentRow[]>()
    .exec();
  const authors = await User.find({
    _id: { $in: [...new Set(docs.map((d) => String(d.authorId)))].map(oid) },
  })
    .select("name")
    .lean<{ _id: mongoose.Types.ObjectId; name?: string }[]>()
    .exec();
  const nameOf = new Map(authors.map((a) => [String(a._id), a.name ?? "—"]));
  return docs
    .map((d) => {
      const state = reviewStateOf(d);
      const me = state.reviewers.find((r) => r.userId === actor.sub) ?? null;
      return {
        id: String(d._id),
        title: d.title,
        type: d.type,
        number: d.number ?? null,
        status: d.status,
        authorName: nameOf.get(String(d.authorId)) ?? "—",
        invitedAt: me?.invitedAt ?? null,
        me,
        open: state.comments.filter((c) => !c.resolvedAt).length,
        updatedAt: new Date(d.updatedAt).toISOString(),
      };
    })
    .sort((a, b) => {
      const ap = a.me?.status === "pending" && OPEN.includes(a.status) ? 0 : 1;
      const bp = b.me?.status === "pending" && OPEN.includes(b.status) ? 0 : 1;
      return ap - bp;
    });
}

export type ReviewDesk = {
  id: string;
  title: string;
  type: DocumentRow["type"];
  number: string | null;
  status: DocumentStatus;
  body: DocumentBody;
  settings: DocumentSettings;
  mergeValues: Record<string, string>;
  state: ReviewState;
  me: ReviewerView | null;
};

/** One document, for the reviewer's desk: the draft as it stands. */
export async function reviewFor(
  actor: ReviewActor,
  id: string,
): Promise<ReviewDesk | null> {
  const doc = await getDocument(id);
  if (!doc || !canReview(doc, actor)) return null;
  const state = reviewStateOf(doc);
  return {
    id: String(doc._id),
    title: doc.title,
    type: doc.type,
    number: doc.number ?? null,
    status: doc.status,
    body: doc.body,
    settings: documentSettingsSchema.parse(doc.settings ?? {}),
    mergeValues: (await mergeValuesFor(doc)) as Record<string, string>,
    state,
    me: state.reviewers.find((r) => r.userId === actor.sub) ?? null,
  };
}

/** "I am done": the author sees it on the document and in the bell. */
export async function finishReview(
  id: string,
  actor: ReviewActor,
  req?: Request,
): Promise<DocumentResult<ReviewState>> {
  const doc = await getDocument(id);
  if (!doc || !canReview(doc, actor)) return { ok: false, code: "not_found" };
  if (!OPEN.includes(doc.status)) return { ok: false, code: "locked" };
  await connectToDatabase();
  const now = new Date();
  const mine = (doc.reviewers ?? []).find(
    (r) => String(r.userId) === actor.sub,
  );
  const name = mine?.name ?? (await displayNameFor(actor.sub));
  const updated = mine
    ? await AuthoredDocument.findOneAndUpdate(
        { _id: oid(id), "reviewers.userId": oid(actor.sub) },
        {
          $set: { "reviewers.$.status": "done", "reviewers.$.actedAt": now },
          $push: { activity: event(actor, "document.review_done", name) },
        },
        { returnDocument: "after" },
      )
        .lean<DocumentRow>()
        .exec()
    : // An admin who was not asked by name still gets a row, so the author
      // sees who looked at it.
      await AuthoredDocument.findOneAndUpdate(
        { _id: oid(id) },
        {
          $push: {
            reviewers: {
              userId: oid(actor.sub),
              employeeId: null,
              name,
              status: "done",
              invitedAt: now,
              actedAt: now,
            },
            activity: event(actor, "document.review_done", name),
          },
        },
        { returnDocument: "after" },
      )
        .lean<DocumentRow>()
        .exec();
  if (!updated) return { ok: false, code: "stale" };
  await audit(
    {
      actorId: actor.sub,
      action: "document.review_done",
      entityType: "AuthoredDocument",
      entityId: id,
    },
    req,
  );
  const open = (updated.comments ?? []).filter((c) => !c.resolvedAt).length;
  await notifyUsers([String(doc.authorId)], {
    type: "document.review",
    title: `${name} finished reviewing ${doc.title}`,
    body: open
      ? `${open} open comment${open === 1 ? "" : "s"}`
      : "No open comments",
    href: `/admin/company/documents/${id}/edit`,
    severity: "info",
    entity: { kind: "authoredDocument", id, ref: doc.number ?? undefined },
  });
  return { ok: true, data: reviewStateOf(updated) };
}
