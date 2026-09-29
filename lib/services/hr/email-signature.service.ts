import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  Employee,
  type IEmployee,
  type IEmployeeEmailSignature,
} from "@/lib/models/employee";
import type { Lean } from "@/lib/models/_shared";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { isBlankHtml, sanitizeOutgoingHtml } from "@/lib/mail/outgoing-html";
import { MAX_SIGNATURE_HTML } from "@/lib/mail/signature";
import { logger } from "@/lib/log";

/**
 * An employee's email signature, set by a super admin on the employee's
 * page. The HTML is cut down to the composer's own allowlist before it is
 * stored, so what the composer later drops into a message is already safe
 * to send; the logo is a flag, never an image in the HTML. Every change is
 * audited and lands in the employee's activity.
 */
export type Actor = { sub: string; email: string };

export type EmailSignatureError = "not_found" | "empty" | "too_long";
export type EmailSignatureResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: EmailSignatureError };

const oid = (id: string) => new mongoose.Types.ObjectId(id);

export async function setEmailSignature(
  employeeId: string,
  input: { html: string; logo: boolean },
  actor: Actor,
  opts: { req?: Request } = {},
): Promise<EmailSignatureResult<IEmployeeEmailSignature>> {
  if (!mongoose.isValidObjectId(employeeId)) {
    return { ok: false, code: "not_found" };
  }
  const html = sanitizeOutgoingHtml(input.html);
  if (isBlankHtml(html)) return { ok: false, code: "empty" };
  if (html.length > MAX_SIGNATURE_HTML) return { ok: false, code: "too_long" };

  await connectToDatabase();
  const current = await Employee.findOne({
    _id: oid(employeeId),
    deletedAt: null,
  })
    .select("emailSignature")
    .lean<Pick<Lean<IEmployee>, "_id" | "emailSignature">>()
    .exec();
  if (!current) return { ok: false, code: "not_found" };
  const before = current.emailSignature ?? null;
  // Saving it unchanged is not an event worth a line in anyone's history.
  if (before && before.html === html && before.logo === input.logo) {
    return { ok: true, data: before };
  }

  const now = new Date();
  const signature = { html, logo: input.logo, updatedAt: now };
  const action = before ? "email_signature.replaced" : "email_signature.set";
  await Employee.updateOne(
    { _id: oid(employeeId), deletedAt: null },
    {
      $set: { emailSignature: signature },
      $push: {
        activity: {
          at: now,
          actorId: oid(actor.sub),
          action,
          note: input.logo ? "with the company logo" : "without the logo",
        },
      },
    },
  ).exec();
  await writeAudit(
    {
      actorId: actor.sub,
      action: `employee.${action}`,
      entityType: "Employee",
      entityId: employeeId,
      before: before ? { html: before.html, logo: before.logo } : null,
      after: { html, logo: input.logo },
    },
    opts.req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  return { ok: true, data: signature };
}

export async function clearEmailSignature(
  employeeId: string,
  actor: Actor,
  opts: { req?: Request } = {},
): Promise<EmailSignatureResult<true>> {
  if (!mongoose.isValidObjectId(employeeId)) {
    return { ok: false, code: "not_found" };
  }
  await connectToDatabase();
  const now = new Date();
  const res = await Employee.updateOne(
    { _id: oid(employeeId), deletedAt: null },
    {
      $set: { emailSignature: null },
      $push: {
        activity: {
          at: now,
          actorId: oid(actor.sub),
          action: "email_signature.removed",
          note: null,
        },
      },
    },
  ).exec();
  if (res.matchedCount === 0) return { ok: false, code: "not_found" };
  await writeAudit(
    {
      actorId: actor.sub,
      action: "employee.email_signature.removed",
      entityType: "Employee",
      entityId: employeeId,
    },
    opts.req,
  ).catch((e) => logger.warn("audit failed", { error: String(e) }));
  return { ok: true, data: true };
}
