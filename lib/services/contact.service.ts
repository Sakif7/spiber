import { connectToDatabase } from "@/lib/db/connect";
import type { IContactMessage } from "@/lib/models/contact-message";
import { createContactMessage as repoCreateContactMessage } from "@/lib/repositories/contact-messages.repo";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { CONTACT } from "@/lib/contact";
import { logger } from "@/lib/log";
import { contactMessageNumber } from "@/lib/ids";
import type {
  ContactInquiryType,
  ContactMessageCreateInput,
} from "@/lib/schemas/contact";

const TYPE_LABEL: Record<ContactInquiryType, string> = {
  sales: "Sales",
  support: "Support",
  quotation: "Quotation",
};

const TYPE_LABEL_BN: Record<ContactInquiryType, string> = {
  sales: "সেলস",
  support: "সহায়তা",
  quotation: "কোটেশন",
};

/**
 * Where each inquiry type is routed. A single `CONTACT_TEAM_EMAIL` env var
 * overrides routing entirely (handy for a shared support inbox / staging).
 */
function teamRecipient(type: ContactInquiryType): string {
  const override = process.env.CONTACT_TEAM_EMAIL?.trim();
  if (override) return override;
  switch (type) {
    case "sales":
      return CONTACT.salesEmail;
    case "quotation":
      return CONTACT.inquiryEmail;
    case "support":
    default:
      return CONTACT.generalEmail;
  }
}

export type ContactMeta = { ip?: string; userAgent?: string };

/**
 * Persist a contact-form submission, notify the team (routed by inquiry type),
 * and send the sender an auto-acknowledgement. Email failures are logged but
 * never fail the request (mirrors the inquiry pipeline).
 */
export async function createContactMessage(
  input: ContactMessageCreateInput,
  meta?: ContactMeta,
): Promise<IContactMessage> {
  await connectToDatabase();
  const doc = await repoCreateContactMessage({
    contactNumber: contactMessageNumber(),
    name: input.name,
    email: input.email,
    phone: input.phone,
    inquiryType: input.inquiryType,
    message: input.message,
    status: "new",
    locale: input.locale,
    meta: meta && (meta.ip || meta.userAgent) ? meta : undefined,
  });
  const record = doc.toObject();

  await Promise.allSettled([
    sendTeamNotification(record),
    sendContactAck(record),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected") {
        logger.warn("contact email failed", r.reason);
      }
    }
  });

  return record;
}

async function sendTeamNotification(msg: IContactMessage) {
  const label = TYPE_LABEL[msg.inquiryType];
  const rows: EmailDetailRow[] = [
    { label: "Name", value: msg.name, strong: true },
    { label: "Email", value: msg.email },
    { label: "Phone", value: msg.phone },
    { label: "Inquiry type", value: label },
    { label: "Reference", value: msg.contactNumber },
  ];
  const built = renderEmail({
    accent: "teal",
    preheader: `New ${label} message from ${msg.name}`,
    eyebrow: "New contact message",
    heading: `New ${label} enquiry`,
    paragraphs: [
      `${msg.name} sent a message via the website contact form. Reply to ${msg.email} or call ${msg.phone}.`,
      msg.message,
    ],
    details: { title: "Submission", rows },
  });
  await getMailer().send({
    to: teamRecipient(msg.inquiryType),
    subject: `New ${label} message — ${msg.name} [${msg.contactNumber}]`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

/** Localized auto-acknowledgement so a Bangla submitter gets a Bangla reply. */
async function sendContactAck(msg: IContactMessage) {
  const bn = msg.locale === "bn";
  const brand = siteConfig.brand;
  const c = bn
    ? {
        subject: `আপনার বার্তা পেয়েছি — ${brand}`,
        preheader: "আমরা আপনার বার্তা পেয়েছি এবং শীঘ্রই যোগাযোগ করব।",
        eyebrow: "বার্তা গৃহীত হয়েছে",
        heading: "যোগাযোগ করার জন্য ধন্যবাদ",
        paragraph: `প্রিয় ${msg.name}, ${brand}-এর সাথে যোগাযোগ করার জন্য ধন্যবাদ। আমরা আপনার বার্তা পেয়েছি এবং আমাদের টিম শীঘ্রই আপনার সাথে যোগাযোগ করবে।`,
        typeLabel: "অনুসন্ধানের ধরন",
        refLabel: "রেফারেন্স",
        typeValue: TYPE_LABEL_BN[msg.inquiryType],
        outro: `জরুরি প্রয়োজনে আমাদের কল করুন ${CONTACT.phone} (সোম–শনি, ০৯:০০–১৮:০০ BST)।`,
      }
    : {
        subject: `We received your message — ${brand}`,
        preheader:
          "We've received your message and will get back to you shortly.",
        eyebrow: "Message received",
        heading: "Thanks for reaching out",
        paragraph: `Hi ${msg.name}, thanks for contacting ${brand}. We've received your message and our team will get back to you shortly.`,
        typeLabel: "Inquiry type",
        refLabel: "Reference",
        typeValue: TYPE_LABEL[msg.inquiryType],
        outro: `If it's urgent, call us at ${CONTACT.phone} (Mon–Sat, 09:00–18:00 BST).`,
      };

  const built = renderEmail({
    accent: "teal",
    preheader: c.preheader,
    eyebrow: c.eyebrow,
    heading: c.heading,
    paragraphs: [c.paragraph],
    details: {
      rows: [
        { label: c.typeLabel, value: c.typeValue },
        { label: c.refLabel, value: msg.contactNumber },
      ],
    },
    outro: [c.outro],
  });
  await getMailer().send({
    to: msg.email,
    subject: c.subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
