import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { type IProductRequest } from "@/lib/models/product-request";
import {
  createProductRequest as repoCreate,
  getProductRequestById,
} from "@/lib/repositories/product-requests.repo";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { CONTACT } from "@/lib/contact";
import { logger } from "@/lib/log";
import { productRequestNumber } from "@/lib/ids";
import {
  PRODUCT_REQUEST_TRANSITIONS,
  type ProductRequestCreateInput,
  type ProductRequestStatus,
} from "@/lib/schemas/product-request";

/** Product-request submissions route to the general inbox unless overridden. */
function teamRecipient(): string {
  return (
    process.env.KART_TEAM_EMAIL?.trim() ||
    process.env.CONTACT_TEAM_EMAIL?.trim() ||
    CONTACT.generalEmail
  );
}

/**
 * Persist a "Request a product" submission, notify the sourcing team, and send
 * the requester a localized auto-acknowledgement. Email failures are logged but
 * never fail the request (mirrors the inquiry/contact pipelines).
 */
export async function createProductRequest(
  input: ProductRequestCreateInput,
): Promise<IProductRequest> {
  await connectToDatabase();
  const doc = await repoCreate({
    requestNumber: productRequestNumber(),
    productName: input.productName,
    category: input.category,
    brand: input.brand,
    quantity: input.quantity,
    budget: input.budget,
    referenceUrl: input.referenceUrl,
    details: input.details,
    name: input.name,
    email: input.email,
    phone: input.phone,
    locale: input.locale,
    status: "new",
    notes: [],
  });
  const record = doc.toObject();

  await Promise.allSettled([
    sendTeamNotification(record),
    sendRequestAck(record),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected") {
        logger.warn("product-request email failed", r.reason);
      }
    }
  });

  return record;
}

export type ProductRequestTransitionResult =
  | { ok: true; request: IProductRequest }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionProductRequest(
  id: string,
  to: ProductRequestStatus,
  opts: { note?: string; actorId?: string } = {},
): Promise<ProductRequestTransitionResult> {
  await connectToDatabase();
  const request = await getProductRequestById(id);
  if (!request) return { ok: false, code: "not_found" };
  if (!PRODUCT_REQUEST_TRANSITIONS[request.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }
  request.status = to;
  if (opts.note && opts.actorId) {
    request.notes.push({
      authorId: new mongoose.Types.ObjectId(opts.actorId),
      body: opts.note,
      at: new Date(),
    });
  }
  await request.save();
  return { ok: true, request: request.toObject() };
}

async function sendTeamNotification(r: IProductRequest) {
  const rows: EmailDetailRow[] = [
    { label: "Product", value: r.productName, strong: true },
    ...(r.category ? [{ label: "Category", value: r.category }] : []),
    ...(r.brand ? [{ label: "Brand", value: r.brand }] : []),
    ...(r.quantity ? [{ label: "Quantity", value: String(r.quantity) }] : []),
    ...(r.budget ? [{ label: "Budget", value: r.budget }] : []),
    ...(r.referenceUrl ? [{ label: "Reference", value: r.referenceUrl }] : []),
    { label: "Requested by", value: r.name },
    { label: "Email", value: r.email },
    ...(r.phone ? [{ label: "Phone", value: r.phone }] : []),
    { label: "Ref", value: r.requestNumber },
  ];
  const built = renderEmail({
    accent: "teal",
    preheader: `New product request from ${r.name}`,
    eyebrow: "New product request",
    heading: `Sourcing request: ${r.productName}`,
    paragraphs: [
      `${r.name} asked us to source a product via Spiber Kart. Reply to ${r.email}${r.phone ? ` or call ${r.phone}` : ""}.`,
      ...(r.details ? [r.details] : []),
    ],
    details: { title: "Request", rows },
  });
  await getMailer().send({
    to: teamRecipient(),
    subject: `Product request — ${r.productName} [${r.requestNumber}]`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

/** Localized auto-acknowledgement (en/bn/ja) to the requester. */
async function sendRequestAck(r: IProductRequest) {
  const brand = siteConfig.brand;
  const c =
    r.locale === "ja"
      ? {
          subject: `製品リクエストを受け付けました — ${brand}`,
          preheader:
            "製品リクエストを受け付けました。調達可否を確認し、追ってご連絡します。",
          eyebrow: "リクエストを受け付けました",
          heading: "リクエストありがとうございます",
          paragraph: `${r.name} 様、「${r.productName}」の調達リクエストを受け付けました。担当チームが確認し、追ってご連絡いたします。`,
          productLabel: "製品",
          refLabel: "受付番号",
          outro: `お急ぎの場合は ${CONTACT.phone} までお電話ください。`,
        }
      : r.locale === "bn"
        ? {
            subject: `আপনার পণ্যের অনুরোধ পেয়েছি — ${brand}`,
            preheader:
              "আমরা আপনার পণ্যের অনুরোধ পেয়েছি এবং শীঘ্রই যোগাযোগ করব।",
            eyebrow: "অনুরোধ গৃহীত হয়েছে",
            heading: "অনুরোধের জন্য ধন্যবাদ",
            paragraph: `প্রিয় ${r.name}, "${r.productName}" সংগ্রহের অনুরোধের জন্য ধন্যবাদ। আমাদের টিম এটি যাচাই করে শীঘ্রই আপনার সাথে যোগাযোগ করবে।`,
            productLabel: "পণ্য",
            refLabel: "রেফারেন্স",
            outro: `জরুরি প্রয়োজনে আমাদের কল করুন ${CONTACT.phone}।`,
          }
        : {
            subject: `We received your product request — ${brand}`,
            preheader:
              "We've received your product request and will get back to you shortly.",
            eyebrow: "Request received",
            heading: "Thanks for your request",
            paragraph: `Hi ${r.name}, thanks for asking us to source "${r.productName}". Our team will review it and get back to you shortly.`,
            productLabel: "Product",
            refLabel: "Reference",
            outro: `If it's urgent, call us at ${CONTACT.phone}.`,
          };

  const built = renderEmail({
    accent: "teal",
    preheader: c.preheader,
    eyebrow: c.eyebrow,
    heading: c.heading,
    paragraphs: [c.paragraph],
    details: {
      rows: [
        { label: c.productLabel, value: r.productName },
        { label: c.refLabel, value: r.requestNumber },
      ],
    },
    outro: [c.outro],
  });
  await getMailer().send({
    to: r.email,
    subject: c.subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
