import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { type ITravelRequest } from "@/lib/models/travelRequest";
import {
  createTravelRequest as repoCreateTravelRequest,
  getTravelRequestById,
} from "@/lib/repositories/travelRequests.repo";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { logger } from "@/lib/log";
import { travelRequestNumber } from "@/lib/ids";
import { getTravelProvider } from "@/lib/travel";
import { tourismTeamRecipient } from "./tourism-notify";
import {
  TRAVEL_REQUEST_TRANSITIONS,
  type TravelRequestCreateInput,
  type TravelRequestQuoteInput,
  type TravelRequestStatus,
  type TravelRequestType,
} from "@/lib/schemas/travel-request";

const TYPE_LABEL: Record<TravelRequestType, string> = {
  air: "Air ticket",
  hotel: "Hotel",
  visa: "Visa assistance",
  transfer: "Airport transfer",
};

export type CreateTravelRequestOpts = { locale?: string };

export async function createTravelRequest(
  input: TravelRequestCreateInput,
  opts: CreateTravelRequestOpts = {},
): Promise<ITravelRequest> {
  await connectToDatabase();
  const provider = getTravelProvider(input.type);
  const doc = await repoCreateTravelRequest({
    travelRequestNumber: travelRequestNumber(),
    type: input.type,
    details: input.details,
    linkedCaseId:
      input.linkedCaseId && mongoose.isValidObjectId(input.linkedCaseId)
        ? new mongoose.Types.ObjectId(input.linkedCaseId)
        : null,
    contact: input.contact,
    provider: provider.name,
    status: "new",
    quote: null,
    activity: [],
  });
  const record = doc.toObject();

  // Hand to the provider (manual default = no-op). Never let this fail the request.
  await Promise.resolve(provider.submit(record)).catch((e) =>
    logger.warn("travel provider submit failed", e),
  );
  await Promise.allSettled([
    sendTravelTeamNotification(record),
    sendTravelAck(record, opts.locale),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected") logger.warn("travel email failed", r.reason);
    }
  });
  return record;
}

export type TravelTransitionResult =
  | { ok: true; request: ITravelRequest }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionTravelRequest(
  id: string,
  to: TravelRequestStatus,
  opts: { note?: string; actorId?: string } = {},
): Promise<TravelTransitionResult> {
  await connectToDatabase();
  const req = await getTravelRequestById(id);
  if (!req) return { ok: false, code: "not_found" };
  if (!TRAVEL_REQUEST_TRANSITIONS[req.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }
  req.status = to;
  if (opts.note && opts.actorId) {
    req.activity.push({
      authorId: new mongoose.Types.ObjectId(opts.actorId),
      body: opts.note,
      at: new Date(),
    });
  }
  await req.save();
  return { ok: true, request: req.toObject() };
}

export type SetTravelQuoteResult =
  | { ok: true; request: ITravelRequest }
  | { ok: false; code: "not_found" };

export async function setTravelQuote(
  id: string,
  input: TravelRequestQuoteInput,
  actorId?: string,
): Promise<SetTravelQuoteResult> {
  await connectToDatabase();
  const req = await getTravelRequestById(id);
  if (!req) return { ok: false, code: "not_found" };
  req.quote = {
    amountMinor: input.amountMinor ?? null,
    note: input.note ?? null,
    sentAt: new Date(),
  };
  if (req.status === "new") req.status = "quoted";
  if (actorId) {
    req.activity.push({
      authorId: new mongoose.Types.ObjectId(actorId),
      body: input.note ? `Quote sent: ${input.note}` : "Quote sent.",
      at: new Date(),
    });
  }
  await req.save();
  await sendTravelQuoteReady(req.toObject()).catch((e) =>
    logger.warn("travel quote email failed", e),
  );
  return { ok: true, request: req.toObject() };
}

// ----------------------------------------------------------------- emails
async function sendTravelTeamNotification(r: ITravelRequest) {
  const label = TYPE_LABEL[r.type];
  const rows: EmailDetailRow[] = [
    { label: "Type", value: label, strong: true },
    { label: "Name", value: r.contact.name },
    { label: "Email", value: r.contact.email },
    { label: "Phone", value: r.contact.phone },
    { label: "Reference", value: r.travelRequestNumber },
  ];
  for (const [k, v] of Object.entries(r.details ?? {})) {
    rows.push({ label: k, value: String(v) });
  }
  const built = renderEmail({
    accent: "orange",
    preheader: `New ${label} request from ${r.contact.name}`,
    eyebrow: "New travel request",
    heading: `New ${label} request`,
    paragraphs: [
      `${r.contact.name} submitted a ${label.toLowerCase()} request. Prepare a quote and confirm manually from the travel-requests queue.`,
    ],
    details: { title: "Request", rows },
  });
  await getMailer().send({
    to: tourismTeamRecipient(),
    subject: `New ${label} request — ${r.contact.name} [${r.travelRequestNumber}]`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendTravelAck(r: ITravelRequest, locale?: string) {
  const bn = locale === "bn";
  const brand = siteConfig.brand;
  const label = TYPE_LABEL[r.type];
  const t = bn
    ? {
        subject: `আপনার অনুরোধ পেয়েছি — ${brand}`,
        eyebrow: "অনুরোধ গৃহীত",
        heading: "আপনার অনুরোধের জন্য ধন্যবাদ",
        paragraph: `প্রিয় ${r.contact.name}, আমরা আপনার অনুরোধ পেয়েছি। আমাদের টিম একটি কোটেশন প্রস্তুত করে শীঘ্রই যোগাযোগ করবে। (এটি একটি অনুরোধ — সরাসরি বুকিং নয়।)`,
        refLabel: "রেফারেন্স",
      }
    : {
        subject: `We received your ${label.toLowerCase()} request — ${brand}`,
        eyebrow: "Request received",
        heading: "Thanks for your request",
        paragraph: `Hi ${r.contact.name}, we've received your ${label.toLowerCase()} request. Our team will prepare a quote and get back to you shortly. (This is a request — not an instant booking.)`,
        refLabel: "Reference",
      };
  const built = renderEmail({
    accent: "orange",
    eyebrow: t.eyebrow,
    heading: t.heading,
    paragraphs: [t.paragraph],
    details: { rows: [{ label: t.refLabel, value: r.travelRequestNumber }] },
  });
  await getMailer().send({
    to: r.contact.email,
    subject: t.subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendTravelQuoteReady(r: ITravelRequest) {
  const rows: EmailDetailRow[] = [
    { label: "Reference", value: r.travelRequestNumber },
  ];
  if (r.quote?.amountMinor != null) {
    const { formatBDT } = await import("@/lib/money");
    rows.push({
      label: "Quoted total",
      value: formatBDT(r.quote.amountMinor),
      strong: true,
    });
  }
  const built = renderEmail({
    accent: "orange",
    preheader: "Your travel quote is ready.",
    eyebrow: "Quote ready",
    heading: `Your ${TYPE_LABEL[r.type].toLowerCase()} quote is ready`,
    paragraphs: [
      `We've prepared a quote for your request ${r.travelRequestNumber}. ${r.quote?.note ?? ""}`.trim(),
    ],
    details: { title: "Quote", rows },
  });
  await getMailer().send({
    to: r.contact.email,
    subject: `Your quote for ${r.travelRequestNumber} is ready`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
