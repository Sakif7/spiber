import mongoose from "mongoose";
import type { ISalesOrder } from "@/lib/models/salesOrder";
import type { Lean } from "@/lib/models/_shared";
import {
  addSalesOrderActivity,
  getSalesOrderById,
} from "@/lib/repositories/sales.repo";
import {
  cancelOpenRequests,
  createRequest,
  getRequestByToken,
  openRequestFor,
  recordRequestSent,
  updateRequestCustomerEmail,
  type LeanRequest,
} from "@/lib/repositories/payment-requests.repo";
import {
  countAttemptsForRequest,
  getAttemptById,
} from "@/lib/repositories/payment-attempts.repo";
import { onlinePointAvailable } from "./payment-availability";
import {
  beginAttempt,
  onlineProvider,
  type StartPaymentResult,
} from "./payment.service";
import { salesEmails } from "./sales-emails";
import {
  linkBasisOf,
  salesLinkAmount,
  withholdingOnRecord,
  type SalesLinkAmount,
} from "@/lib/sales/payment-link";
import {
  isTourismKind,
  loadTourismSubject,
  TOURISM_PAYABLE,
  type TourismKind,
} from "@/lib/repositories/tourism-payments.repo";
import { getMailer } from "@/lib/mailer";
import { renderEmail } from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { formatBDT } from "@/lib/money";
import {
  MAX_OPEN_BILL_ATTEMPTS,
  type PaymentLinkBasis,
  type PaymentLinkInput,
} from "@/lib/schemas/payment";

/**
 * Pay links: `/pay/<token>`, one per Sales invoice, made by a super admin and
 * copied or emailed to the client. The link is a page of ours, not
 * PayStation's: every press of Pay opens a fresh attempt, so a declined card
 * or a closed tab never spoils it, and whichever attempt settles closes it
 * (`applyToSalesOrder` in payment.service).
 */

type LeanSalesOrder = Lean<ISalesOrder>;

export type SalesLinkRefusal =
  | "not_found"
  | "not_invoiced"
  | "paid_order"
  | "nothing_to_pay"
  | "payment_unavailable"
  | "basis_required"
  | "recipient_mismatch";

/** Why a link cannot be made for this order now, or null when it can. */
async function salesLinkBlock(
  order: LeanSalesOrder,
): Promise<SalesLinkRefusal | null> {
  if (order.payment.status === "paid") return "paid_order";
  if (order.status !== "invoiced" && order.status !== "delivered") {
    return "not_invoiced";
  }
  if (salesLinkAmount(order, "full").amountMinor <= 0) return "nothing_to_pay";
  if (!(await onlinePointAvailable("sales_link"))) {
    return "payment_unavailable";
  }
  return null;
}

/** The public address of a link (English; the page follows the visitor). */
export const payLinkUrl = (token: string): string =>
  `${siteConfig.url}/pay/${token}`;

const isDuplicateKey = (e: unknown): boolean =>
  (e as { code?: number } | null)?.code === 11000;

export type SalesLinkResult =
  | { ok: true; link: LeanRequest; created: boolean; sentTo: string | null }
  | { ok: false; code: SalesLinkRefusal };

/**
 * Make the order's pay link — or hand back the one already open when it
 * still asks for the same amount on the same basis — and email it when asked.
 *
 * While AIT/VDS is on record the caller must say which amount (`basis`); with
 * none on record there is only the total. An open link for a different
 * amount or basis (the invoice was reissued, the AIT on record changed, or
 * the other amount was chosen) is withdrawn first: one link pays one invoice
 * for one amount. Sending anywhere but the client's stored address needs an
 * explicit yes, as for the invoice itself.
 */
export async function ensureSalesPaymentLink(
  orderId: string,
  input: PaymentLinkInput,
  actor: { sub: string },
): Promise<SalesLinkResult> {
  const order = await getSalesOrderById(orderId);
  if (!order) return { ok: false, code: "not_found" };
  const blocked = await salesLinkBlock(order);
  if (blocked) return { ok: false, code: blocked };
  const onRecord = withholdingOnRecord(order);
  if (onRecord > 0 && !input.basis)
    return { ok: false, code: "basis_required" };
  const basis: PaymentLinkBasis = onRecord > 0 ? input.basis! : "full";

  const stored = order.leadSnapshot.email?.toLowerCase() ?? null;
  if (
    input.send &&
    stored &&
    input.email !== stored &&
    !input.confirmRecipient
  ) {
    return { ok: false, code: "recipient_mismatch" };
  }

  const amount = salesLinkAmount(order, basis);
  const ref = order.invoiceNumber ?? order.number;
  let link = await openRequestFor("sales_order", orderId);
  let created = false;
  if (
    link &&
    (linkBasisOf(link) !== basis ||
      link.amountMinor !== amount.amountMinor ||
      link.dueMinor !== amount.dueMinor ||
      link.subject.ref !== ref)
  ) {
    await cancelOpenRequests("sales_order", orderId, "replaced by a new link");
    await addSalesOrderActivity(orderId, {
      authorId: actor.sub,
      body: `Payment link for ${formatBDT(link.amountMinor)} withdrawn — replaced by one for ${formatBDT(amount.amountMinor)}`,
    });
    link = null;
  }
  if (!link) {
    try {
      link = await createRequest({
        subject: { kind: "sales_order", id: order._id, ref },
        basis,
        dueMinor: amount.dueMinor,
        withheldMinor: amount.withheldMinor,
        amountMinor: amount.amountMinor,
        roundingMinor: amount.roundingMinor,
        description: `Invoice ${ref} · ${order.leadSnapshot.organisation}`,
        customer: {
          name: order.leadSnapshot.contactName,
          organisation: order.leadSnapshot.organisation,
          email: input.email,
          phone: order.leadSnapshot.phone || null,
        },
        sentTo: [],
        createdBy: new mongoose.Types.ObjectId(actor.sub),
      });
      created = true;
    } catch (e) {
      // Another super admin made one in the same instant: use theirs.
      if (!isDuplicateKey(e)) throw e;
      link = await openRequestFor("sales_order", orderId);
      if (!link) throw e;
    }
    if (created) {
      await addSalesOrderActivity(orderId, {
        authorId: actor.sub,
        body: `Payment link made for ${formatBDT(link.amountMinor)}${
          onRecord > 0
            ? basis === "full"
              ? " — the full total; AIT withheld becomes ৳0 when it is paid"
              : " — the total less the AIT on record"
            : ""
        }`,
      });
    }
  }
  if (link.customer.email !== input.email) {
    await updateRequestCustomerEmail(link._id, input.email);
    link = { ...link, customer: { ...link.customer, email: input.email } };
  }

  if (input.send) {
    await mailSalesLink(order, link, amount, input.email);
    await recordRequestSent(link._id, input.email, actor.sub);
    await addSalesOrderActivity(orderId, {
      authorId: actor.sub,
      body: `Payment link emailed to ${input.email}`,
    });
  }
  return { ok: true, link, created, sentTo: input.send ? input.email : null };
}

async function mailSalesLink(
  order: LeanSalesOrder,
  link: LeanRequest,
  amount: SalesLinkAmount,
  to: string,
): Promise<void> {
  const ref = link.subject.ref;
  const { teamInbox, mdEmail } = await salesEmails();
  const paragraphs = [
    `You can pay invoice ${ref} online — by bKash, Nagad, Rocket, Upay or card — through the secure link below.`,
  ];
  if (amount.withheldMinor > 0) {
    paragraphs.push(
      `The link is for ${formatBDT(link.amountMinor)}: the invoice total of ${formatBDT(amount.totalMinor)} less the ${formatBDT(amount.withheldMinor)} you deduct at source.`,
    );
  }
  const { html, text, attachments } = renderEmail({
    preheader: `Invoice ${ref}: ${formatBDT(link.amountMinor)}, payable online`,
    heading: `Pay invoice ${ref} online`,
    greetingName: order.leadSnapshot.contactName,
    paragraphs,
    details: {
      rows: [
        { label: "Invoice", value: ref },
        { label: "Client", value: order.leadSnapshot.organisation },
        { label: "Amount", value: formatBDT(link.amountMinor), strong: true },
      ],
    },
    button: { label: "Pay online", url: payLinkUrl(link.token) },
    outro: [
      "The link stays open until the invoice is paid. If anything on it looks wrong, reply to this email.",
    ],
  });
  await getMailer().send({
    to,
    // The sales inbox keeps a copy of everything that goes to a client.
    cc: teamInbox,
    replyTo: mdEmail,
    subject: `Invoice ${ref} — pay online`,
    html,
    text,
    attachments,
  });
}

/** Withdraw the order's open link; the client's copy stops working. */
export async function cancelSalesPaymentLink(
  orderId: string,
  actor: { sub: string },
): Promise<{ ok: true; cancelled: number } | { ok: false; code: "not_found" }> {
  const order = await getSalesOrderById(orderId);
  if (!order) return { ok: false, code: "not_found" };
  const cancelled = await cancelOpenRequests(
    "sales_order",
    orderId,
    "withdrawn",
  );
  if (cancelled > 0) {
    await addSalesOrderActivity(orderId, {
      authorId: actor.sub,
      body: "Payment link withdrawn",
    });
  }
  return { ok: true, cancelled };
}

// ───────────────────────────── the payer's side ─────────────────────────────

/**
 * open        can be paid now
 * paid        paid through this link
 * settled     the invoice was paid some other way
 * closed      withdrawn, replaced, or the invoice was taken back
 * outdated    the amount owed has changed since the link was made
 * unavailable online payment is switched off for now
 */
export type PayLinkState =
  | "open"
  | "paid"
  | "settled"
  | "closed"
  | "outdated"
  | "unavailable";

/** Everything the payment page shows; nothing the payer should not see. */
export type PayLinkView = {
  state: PayLinkState;
  /** What is being paid: a Sales invoice, a medical case, a travel request. */
  kind: "invoice" | "case" | "travel";
  ref: string;
  organisation: string | null;
  payerName: string;
  amountMinor: number;
  totalMinor: number;
  withheldMinor: number;
  roundingMinor: number;
  paidAt: string | null;
  trxId: string | null;
  /** The link has no phone, and PayStation needs one. */
  askPhone: boolean;
};

type LinkState = { state: PayLinkState; totalMinor: number };

/** How a link stands now, asked of what it pays for. */
async function linkState(link: LeanRequest): Promise<LinkState> {
  const kind = link.subject.kind;
  if (isTourismKind(kind)) return tourismLinkState(link, kind);
  if (kind === "sales_order") return salesLinkState(link);
  return { state: "closed", totalMinor: link.dueMinor };
}

/**
 * A tourism quote's link: payable while the case or request is, until it is
 * paid; out of date once a newer quote asks for another amount.
 */
async function tourismLinkState(
  link: LeanRequest,
  kind: TourismKind,
): Promise<LinkState> {
  const s = await loadTourismSubject(kind, String(link.subject.id));
  const totalMinor = link.dueMinor;
  if (link.status === "paid") return { state: "paid", totalMinor };
  if (!s) return { state: "closed", totalMinor };
  if (s.payment?.status === "paid") return { state: "settled", totalMinor };
  if (link.status !== "open") return { state: "closed", totalMinor };
  if (!TOURISM_PAYABLE[kind].includes(s.status)) {
    return { state: "closed", totalMinor };
  }
  if ((s.collectOnlineMinor ?? 0) !== link.amountMinor) {
    return { state: "outdated", totalMinor };
  }
  if (!onlineProvider() || !(await onlinePointAvailable("tourism"))) {
    return { state: "unavailable", totalMinor };
  }
  return { state: "open", totalMinor };
}

async function salesLinkState(link: LeanRequest): Promise<LinkState> {
  const order = await getSalesOrderById(String(link.subject.id));
  const totalMinor = order?.totalMinor ?? link.dueMinor + link.withheldMinor;
  if (link.status === "paid") return { state: "paid", totalMinor };
  if (!order) return { state: "closed", totalMinor };
  if (order.payment.status === "paid") return { state: "settled", totalMinor };
  if (link.status !== "open") return { state: "closed", totalMinor };
  if (order.status !== "invoiced" && order.status !== "delivered") {
    return { state: "closed", totalMinor };
  }
  // Worked out again on the link's own basis: a full-total link does not go
  // out of date because the AIT on record changed.
  const now = salesLinkAmount(order, linkBasisOf(link));
  if (now.amountMinor !== link.amountMinor || now.dueMinor !== link.dueMinor) {
    return { state: "outdated", totalMinor };
  }
  if (!onlineProvider() || !(await onlinePointAvailable("sales_link"))) {
    return { state: "unavailable", totalMinor };
  }
  return { state: "open", totalMinor };
}

export async function payLinkView(token: string): Promise<PayLinkView | null> {
  const link = await getRequestByToken(token);
  if (!link) return null;
  const { state, totalMinor } = await linkState(link);
  const attempt =
    state === "paid" && link.attemptId
      ? await getAttemptById(String(link.attemptId))
      : null;
  return {
    state,
    kind:
      link.subject.kind === "medical_case"
        ? "case"
        : link.subject.kind === "travel_request"
          ? "travel"
          : "invoice",
    ref: link.subject.ref,
    organisation: link.customer.organisation ?? null,
    payerName: link.customer.name,
    amountMinor: link.amountMinor,
    totalMinor,
    withheldMinor: link.withheldMinor ?? 0,
    roundingMinor: link.roundingMinor ?? 0,
    paidAt: link.paidAt ? new Date(link.paidAt).toISOString() : null,
    trxId: attempt?.trxId ?? null,
    askPhone: !link.customer.phone?.trim(),
  };
}

export type LinkStartResult =
  | StartPaymentResult
  | { ok: false; reason: "phone_required" | "closed" | "outdated" };

/** The payer pressed Pay: a fresh try at the gateway for the link's amount. */
export async function startLinkPayment(
  token: string,
  opts: { phone?: string | null; locale?: string | null } = {},
): Promise<LinkStartResult> {
  const link = await getRequestByToken(token);
  if (!link) return { ok: false, reason: "not_found" };
  const { state } = await linkState(link);
  if (state === "outdated") return { ok: false, reason: "outdated" };
  if (state === "unavailable") return { ok: false, reason: "unavailable" };
  if (state !== "open") return { ok: false, reason: "closed" };
  const provider = onlineProvider();
  if (!provider) return { ok: false, reason: "unavailable" };
  if ((await countAttemptsForRequest(link._id)) >= MAX_OPEN_BILL_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }
  const phone = opts.phone?.trim() || link.customer.phone?.trim() || "";
  if (!phone) return { ok: false, reason: "phone_required" };

  return beginAttempt({
    provider,
    subject: link.subject,
    amountMinor: link.amountMinor,
    roundingMinor: link.roundingMinor,
    customer: {
      name: link.customer.organisation
        ? `${link.customer.name} (${link.customer.organisation})`
        : link.customer.name,
      phone,
      email: link.customer.email,
    },
    reference: link.subject.ref,
    description: link.description,
    locale: opts.locale,
    requestId: link._id,
  });
}
