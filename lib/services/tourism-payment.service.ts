import mongoose from "mongoose";
import {
  cancelOpenRequests,
  createRequest,
  openRequestFor,
  updateRequestCustomerEmail,
  type LeanRequest,
} from "@/lib/repositories/payment-requests.repo";
import {
  addTourismActivity,
  loadTourismSubject,
  setTourismPassedOn,
  TOURISM_PAYABLE,
  type TourismKind,
  type TourismSubject,
} from "@/lib/repositories/tourism-payments.repo";
import { onlinePointAvailable } from "./payment-availability";
import { getMailer } from "@/lib/mailer";
import { renderEmail } from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";

/**
 * Tourism quotes paid online (owner, 2026-10-28): staff type on each quote
 * what to collect online — the whole quote, an advance, or only our fee — and
 * the patient gets a pay link (`/pay/<token>`) in the quote email, on their
 * account and on the case lookup. One online payment per quote; once it is
 * paid, a case moves quoted → confirmed (`applyToTourism`, payment.service).
 */

/** The public address of a link (English; the page follows the visitor). */
const linkUrl = (token: string): string => `${siteConfig.url}/pay/${token}`;

/**
 * Give the quote its pay link — or take it away. Called whenever a quote is
 * sent: a link for the amount to collect when there is one, the door is open
 * and the quote is not paid yet; an open link for another amount is withdrawn
 * first. Returns the open link, or null when nothing is offered online.
 */
export async function ensureTourismLink(
  kind: TourismKind,
  id: string,
  actorId?: string | null,
): Promise<LeanRequest | null> {
  const s = await loadTourismSubject(kind, id);
  if (!s) return null;
  const open = await openRequestFor(kind, id);
  const collect = s.collectOnlineMinor ?? 0;
  const payable =
    collect > 0 &&
    s.payment?.status !== "paid" &&
    TOURISM_PAYABLE[kind].includes(s.status);
  if (!payable || !(await onlinePointAvailable("tourism"))) {
    if (open) {
      await cancelOpenRequests(kind, id, "no online payment on the new quote");
      await addTourismActivity(
        kind,
        id,
        "Pay link withdrawn — the new quote has no online payment",
        actorId,
      );
    }
    return null;
  }
  if (open && open.amountMinor === collect) {
    if (open.customer.email !== s.customer.email) {
      await updateRequestCustomerEmail(open._id, s.customer.email);
    }
    return open;
  }
  if (open) {
    await cancelOpenRequests(kind, id, "replaced by a new quote");
  }
  try {
    const link = await createRequest({
      subject: { kind, id: s.id, ref: s.ref },
      dueMinor: collect,
      withheldMinor: 0,
      amountMinor: collect,
      roundingMinor: 0,
      description: `${s.label} ${s.ref}${s.detail ? ` · ${s.detail}` : ""}`,
      customer: {
        name: s.customer.name,
        email: s.customer.email,
        phone: s.customer.phone || null,
      },
      sentTo: [],
      createdBy:
        actorId && mongoose.isValidObjectId(actorId)
          ? new mongoose.Types.ObjectId(actorId)
          : null,
    });
    await addTourismActivity(
      kind,
      id,
      `Pay link made for ${formatBDT(collect)}${open ? ` (the one for ${formatBDT(open.amountMinor)} no longer works)` : ""}`,
      actorId,
    );
    return link;
  } catch (e) {
    // The same quote sent twice at once: use the link the other made.
    if ((e as { code?: number } | null)?.code !== 11000) throw e;
    return openRequestFor(kind, id);
  }
}

/** Withdraw the open link (the quote was lost, closed or cancelled). */
export async function withdrawTourismLink(
  kind: TourismKind,
  id: string,
  reason: string,
): Promise<void> {
  await cancelOpenRequests(kind, id, reason).catch((e) =>
    logger.warn(`could not withdraw the ${kind} pay link`, e),
  );
}

/**
 * What the patient's own pages show about paying online. `path` is the pay
 * page without the site or a locale, so a page's own Link puts the visitor's
 * language in front of it.
 */
export type TourismPayView =
  | { state: "open"; amountMinor: number; path: string }
  | { state: "paid"; amountMinor: number; paidAt: string | null }
  | null;

export async function tourismPayView(
  kind: TourismKind,
  id: string,
): Promise<TourismPayView> {
  const s = await loadTourismSubject(kind, id);
  if (!s) return null;
  if (s.payment?.status === "paid") {
    return {
      state: "paid",
      amountMinor: s.payment.amountMinor ?? 0,
      paidAt: s.payment.paidAt
        ? new Date(s.payment.paidAt).toISOString()
        : null,
    };
  }
  const open = await openRequestFor(kind, id);
  if (!open || !TOURISM_PAYABLE[kind].includes(s.status)) return null;
  if (!(await onlinePointAvailable("tourism"))) return null;
  return {
    state: "open",
    amountMinor: open.amountMinor,
    path: `/pay/${open.token}`,
  };
}

/** The open link's address, for the quote email and the admin page. */
export const tourismLinkUrl = linkUrl;

/** Staff record what was passed on to the hospital / airline (the cost). */
export async function setPassedOn(
  kind: TourismKind,
  id: string,
  passedOnMinor: number | null,
  actorId: string,
): Promise<boolean> {
  const to =
    kind === "medical_case" ? "the hospital" : "the airline or provider";
  return setTourismPassedOn(
    kind,
    id,
    passedOnMinor,
    passedOnMinor == null
      ? `Amount passed on to ${to} cleared`
      : `Passed on to ${to}: ${formatBDT(passedOnMinor)}`,
    actorId,
  );
}

/** The patient's receipt once the gateway has confirmed the money. */
export async function sendTourismReceipt(
  s: TourismSubject,
  paidMinor: number,
  trxId: string,
): Promise<void> {
  const built = renderEmail({
    accent: "orange",
    preheader: `We received ${formatBDT(paidMinor)} for ${s.ref}.`,
    eyebrow: "Payment received",
    heading: "Thank you — your payment is in",
    greetingName: s.customer.name,
    paragraphs: [
      `We received your online payment for ${s.label.toLowerCase()} ${s.ref}. Our team will be in touch about the next steps.`,
    ],
    details: {
      title: "Payment",
      rows: [
        { label: "Reference", value: s.ref },
        { label: "Paid", value: formatBDT(paidMinor), strong: true },
        { label: "Transaction", value: trxId },
      ],
    },
  });
  await getMailer().send({
    to: s.customer.email,
    subject: `Payment received for ${s.ref}`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
