import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product, type IProduct } from "@/lib/models/product";
import type { Lean } from "@/lib/models/_shared";
import { type IQuotation, type IQuotationItem } from "@/lib/models/quotation";
import {
  createQuotation as repoCreateQuotation,
  getQuotationById,
} from "@/lib/repositories/quotations.repo";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { logger } from "@/lib/log";
import { quotationNumber } from "@/lib/ids";
import { notifyAdmins } from "./notification.service";
import {
  QUOTATION_TRANSITIONS,
  type QuotationCreateInput,
  type QuotationQuoteInput,
  type QuotationStatus,
} from "@/lib/schemas/quotation";

export type CreateQuotationResult =
  | { ok: true; quotation: IQuotation }
  | { ok: false; code: "empty" | "product_unavailable" };

/** Build immutable item snapshots from current Instruments products. */
async function buildItems(
  inputItems: QuotationCreateInput["items"],
): Promise<IQuotationItem[] | null> {
  await connectToDatabase();
  const ids = inputItems.map((i) => i.productId);
  const products = await Product.find({
    _id: { $in: ids },
    storefront: "instruments",
    deletedAt: null,
  })
    .lean<Lean<IProduct>[]>()
    .exec();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items: IQuotationItem[] = [];
  for (const it of inputItems) {
    const p = byId.get(it.productId);
    if (!p) return null;
    const variantId = it.variantId ?? null;
    const variant = variantId
      ? p.variants?.find((v) => v.id === variantId)
      : undefined;
    if (variantId && !variant) return null;
    items.push({
      productId: p._id,
      variantId,
      productSnapshot: {
        name: p.name,
        sku: variant?.sku ?? p.sku,
        slug: p.slug,
        image: variant?.image ?? p.images[0],
        variantOptions: variant?.options ?? [],
        priceMinor: variant?.priceMinorOverride ?? p.priceMinor ?? null,
        floorPriceMinor: p.floorPriceMinor ?? null,
      },
      quantity: it.quantity,
    });
  }
  return items;
}

export async function createQuotation(
  input: QuotationCreateInput,
  requesterId?: string,
): Promise<CreateQuotationResult> {
  await connectToDatabase();
  if (input.items.length === 0) return { ok: false, code: "empty" };
  const items = await buildItems(input.items);
  if (!items) return { ok: false, code: "product_unavailable" };

  const doc = await repoCreateQuotation({
    quotationNumber: quotationNumber(),
    requesterId: requesterId ? new mongoose.Types.ObjectId(requesterId) : null,
    contact: input.contact,
    items,
    deliveryLocation: input.deliveryLocation,
    timeline: input.timeline,
    notes: input.notes,
    status: "new",
    quote: null,
    activity: [],
    attachments: [],
  });
  await sendQuotationAck(doc.toObject()).catch((e) =>
    logger.warn("quotation ack email failed", e),
  );
  await notifyAdmins({
    type: "quotation.submitted",
    severity: "info",
    title: `New quotation request ${doc.quotationNumber}`,
    body: `${items.length} item(s) · ${input.contact.name}`,
    href: `/admin/quotations/${String(doc._id)}`,
    entity: {
      kind: "QuotationRequest",
      id: String(doc._id),
      ref: doc.quotationNumber,
    },
  });
  return { ok: true, quotation: doc.toObject() };
}

export type QuotationTransitionResult =
  | { ok: true; quotation: IQuotation }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionQuotation(
  id: string,
  to: QuotationStatus,
  opts: { note?: string; actorId?: string } = {},
): Promise<QuotationTransitionResult> {
  await connectToDatabase();
  const quotation = await getQuotationById(id);
  if (!quotation) return { ok: false, code: "not_found" };
  if (!QUOTATION_TRANSITIONS[quotation.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }
  quotation.status = to;
  if (opts.note && opts.actorId) {
    quotation.activity.push({
      authorId: new mongoose.Types.ObjectId(opts.actorId),
      body: opts.note,
      at: new Date(),
    });
  }
  await quotation.save();
  return { ok: true, quotation: quotation.toObject() };
}

export type SetQuoteResult =
  | { ok: true; quotation: IQuotation }
  | { ok: false; code: "not_found" };

/** Staff enters a quoted price / validity / attached PDF and notifies the buyer. */
export async function setQuote(
  id: string,
  input: QuotationQuoteInput,
  actorId?: string,
): Promise<SetQuoteResult> {
  await connectToDatabase();
  const quotation = await getQuotationById(id);
  if (!quotation) return { ok: false, code: "not_found" };

  quotation.quote = {
    amountMinor: input.amountMinor ?? null,
    validUntil: input.validUntil ?? null,
    fileKey: input.fileKey ?? null,
    note: input.note ?? null,
  };
  // Entering a quote moves a `new` request to `quoted`.
  if (quotation.status === "new") quotation.status = "quoted";
  if (actorId) {
    quotation.activity.push({
      authorId: new mongoose.Types.ObjectId(actorId),
      body: input.note
        ? `Quote sent: ${input.note}`
        : "Quote sent to requester.",
      at: new Date(),
    });
  }
  await quotation.save();
  await sendQuoteReady(quotation.toObject()).catch((e) =>
    logger.warn("quote-ready email failed", e),
  );
  return { ok: true, quotation: quotation.toObject() };
}

async function sendQuotationAck(quotation: IQuotation) {
  const rows: EmailDetailRow[] = [
    { label: "Reference", value: quotation.quotationNumber },
    { label: "Items", value: String(quotation.items.length) },
    {
      label: "Deliver to",
      value: quotation.deliveryLocation.city
        ? `${quotation.deliveryLocation.city}, ${quotation.deliveryLocation.district}`
        : quotation.deliveryLocation.district,
    },
  ];
  const built = renderEmail({
    accent: "teal",
    preheader:
      "We've received your quotation request and will respond shortly.",
    eyebrow: "Quotation received",
    heading: "Thanks for your quotation request",
    paragraphs: [
      `Thanks for your interest in ${siteConfig.brand} Instruments. We've received your request and our team will prepare a quotation and get back to you shortly.`,
    ],
    details: { title: "Your request", rows },
  });
  await getMailer().send({
    to: quotation.contact.email,
    subject: `We received your quotation request ${quotation.quotationNumber}`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendQuoteReady(quotation: IQuotation) {
  const rows: EmailDetailRow[] = [
    { label: "Reference", value: quotation.quotationNumber },
  ];
  if (quotation.quote?.amountMinor != null) {
    const { formatBDT } = await import("@/lib/money");
    rows.push({
      label: "Quoted total",
      value: formatBDT(quotation.quote.amountMinor),
      strong: true,
    });
  }
  if (quotation.quote?.validUntil) {
    rows.push({
      label: "Valid until",
      value: new Date(quotation.quote.validUntil).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    });
  }
  const built = renderEmail({
    accent: "teal",
    preheader: "Your quotation is ready.",
    eyebrow: "Quotation ready",
    heading: "Your quotation is ready",
    paragraphs: [
      `We've prepared a quotation for your request ${quotation.quotationNumber}. ${quotation.quote?.note ?? ""}`.trim(),
    ],
    details: { title: "Quotation", rows },
    button: {
      label: "View your quotations",
      url: `${siteConfig.url}/en/account/quotations`,
    },
  });
  await getMailer().send({
    to: quotation.contact.email,
    subject: `Your quotation ${quotation.quotationNumber} is ready`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
