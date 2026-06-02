import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { type IInquiry } from "@/lib/models/inquiry";
import {
  createInquiry as repoCreateInquiry,
  getInquiryById,
} from "@/lib/repositories/inquiries.repo";
import { getMailer } from "@/lib/mailer";
import { siteConfig } from "@/lib/site-config";
import { logger } from "@/lib/log";
import { inquiryNumber } from "@/lib/ids";
import {
  INQUIRY_TRANSITIONS,
  type InquiryCreateInput,
  type InquiryStatus,
} from "@/lib/schemas/inquiry";

/** Create a lead/inquiry and send the submitter an auto-acknowledgement. */
export async function createInquiry(
  input: InquiryCreateInput,
): Promise<IInquiry> {
  await connectToDatabase();
  const doc = await repoCreateInquiry({
    inquiryNumber: inquiryNumber(),
    division: input.division,
    subject: input.subject,
    name: input.name,
    email: input.email,
    phone: input.phone,
    company: input.company,
    message: input.message,
    budgetRange: input.budgetRange,
    linkedEntity: input.linkedEntity ?? null,
    payload: input.payload,
    status: "new",
    notes: [],
    attachments: [],
  });
  await sendInquiryAck(doc.toObject()).catch((e) =>
    logger.warn("inquiry ack email failed", e),
  );
  return doc.toObject();
}

export type InquiryTransitionResult =
  | { ok: true; inquiry: IInquiry }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionInquiry(
  id: string,
  to: InquiryStatus,
  opts: { note?: string; actorId?: string } = {},
): Promise<InquiryTransitionResult> {
  await connectToDatabase();
  const inquiry = await getInquiryById(id);
  if (!inquiry) return { ok: false, code: "not_found" };
  if (!INQUIRY_TRANSITIONS[inquiry.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }
  inquiry.status = to;
  if (opts.note && opts.actorId) {
    inquiry.notes.push({
      authorId: new mongoose.Types.ObjectId(opts.actorId),
      body: opts.note,
      at: new Date(),
    });
  }
  await inquiry.save();
  return { ok: true, inquiry: inquiry.toObject() };
}

async function sendInquiryAck(inquiry: IInquiry) {
  const subject = inquiry.subject
    ? `We received your inquiry: ${inquiry.subject}`
    : `We received your inquiry`;
  const body = `Thanks for reaching out to ${siteConfig.brand}. We've received your inquiry and our team will get back to you shortly.`;
  await getMailer().send({
    to: inquiry.email,
    subject,
    text: `${subject}\n\n${body}\n\nReference: ${inquiry.inquiryNumber}\n\n${siteConfig.brand}`,
    html: `<p>${body}</p><p>Reference: <strong>${inquiry.inquiryNumber}</strong></p><p>${siteConfig.brand}</p>`,
  });
}
