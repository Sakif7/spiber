import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { notifyAdmins } from "./notification.service";
import { type IPartnerApplication } from "@/lib/models/partnerApplication";
import {
  createPartnerApplication as repoCreatePartnerApplication,
  getPartnerApplicationById,
} from "@/lib/repositories/partnerApplications.repo";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { logger } from "@/lib/log";
import { partnerApplicationNumber } from "@/lib/ids";
import { tourismTeamRecipient } from "./tourism-notify";
import {
  PARTNER_APP_TRANSITIONS,
  type PartnerApplicationCreateInput,
  type PartnerApplicationStatus,
} from "@/lib/schemas/partner-application";

export type CreatePartnerApplicationOpts = { locale?: string };

export async function createPartnerApplication(
  input: PartnerApplicationCreateInput,
  opts: CreatePartnerApplicationOpts = {},
): Promise<IPartnerApplication> {
  await connectToDatabase();
  const now = new Date();
  const doc = await repoCreatePartnerApplication({
    partnerApplicationNumber: partnerApplicationNumber(),
    type: input.type,
    orgInfo: input.orgInfo,
    contact: input.contact,
    documents: (input.documents ?? []).map((d) => ({
      name: d.name,
      fileKey: d.fileKey,
      contentType: d.contentType,
      uploadedAt: now,
    })),
    status: "new",
    activity: [],
  });
  const record = doc.toObject();
  await Promise.allSettled([
    sendPartnerTeamNotification(record),
    sendPartnerAck(record, opts.locale),
    notifyAdmins({
      type: "tourism.partner_applied",
      severity: "info",
      title: `New partner application ${record.partnerApplicationNumber}`,
      body: record.orgInfo.name,
      href: `/admin/tourism/partners/${String(doc._id)}`,
      entity: {
        kind: "PartnerApplication",
        id: String(doc._id),
        ref: record.partnerApplicationNumber,
      },
    }),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected")
        logger.warn("partner email failed", r.reason);
    }
  });
  return record;
}

export type PartnerTransitionResult =
  | { ok: true; application: IPartnerApplication }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionPartnerApplication(
  id: string,
  to: PartnerApplicationStatus,
  opts: { note?: string; actorId?: string } = {},
): Promise<PartnerTransitionResult> {
  await connectToDatabase();
  const app = await getPartnerApplicationById(id);
  if (!app) return { ok: false, code: "not_found" };
  if (!PARTNER_APP_TRANSITIONS[app.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }
  app.status = to;
  if (opts.note && opts.actorId) {
    app.activity.push({
      authorId: new mongoose.Types.ObjectId(opts.actorId),
      body: opts.note,
      at: new Date(),
    });
  }
  await app.save();
  if (to === "approved" || to === "rejected") {
    await sendPartnerDecision(app.toObject()).catch((e) =>
      logger.warn("partner decision email failed", e),
    );
  }
  return { ok: true, application: app.toObject() };
}

// ----------------------------------------------------------------- emails
async function sendPartnerTeamNotification(a: IPartnerApplication) {
  const rows: EmailDetailRow[] = [
    { label: "Organization", value: a.orgInfo.name, strong: true },
    { label: "Type", value: a.type },
    { label: "Contact", value: a.contact.name },
    { label: "Email", value: a.contact.email },
    { label: "Phone", value: a.contact.phone },
    { label: "Reference", value: a.partnerApplicationNumber },
    { label: "Documents", value: String(a.documents.length) },
  ];
  const built = renderEmail({
    accent: "orange",
    preheader: `New partner application from ${a.orgInfo.name}`,
    eyebrow: "New partner application",
    heading: "A new partner application was submitted",
    paragraphs: [
      `${a.orgInfo.name} applied to partner as a ${a.type}. Review it from the partner-applications pipeline.`,
      a.orgInfo.description ?? "",
    ].filter(Boolean),
    details: { title: "Application", rows },
  });
  await getMailer().send({
    to: tourismTeamRecipient(),
    subject: `New partner application — ${a.orgInfo.name} [${a.partnerApplicationNumber}]`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendPartnerAck(a: IPartnerApplication, locale?: string) {
  const brand = siteConfig.brand;
  const t =
    locale === "ja"
      ? {
          subject: `パートナー申請を受け付けました — ${brand}`,
          eyebrow: "申請を受領しました",
          heading: "ご関心をお寄せいただきありがとうございます",
          paragraph: `${a.contact.name} 様、${brand} とのパートナーシップにお申し込みいただき、ありがとうございます。担当チームが申請内容を確認のうえ、改めてご連絡いたします。`,
          refLabel: "参照番号",
        }
      : locale === "bn"
        ? {
            subject: `আপনার আবেদন পেয়েছি — ${brand}`,
            eyebrow: "আবেদন গৃহীত",
            heading: "আপনার আগ্রহের জন্য ধন্যবাদ",
            paragraph: `প্রিয় ${a.contact.name}, ${brand}-এর সাথে অংশীদার হওয়ার জন্য আবেদন করার জন্য ধন্যবাদ। আমাদের টিম আপনার আবেদন পর্যালোচনা করে যোগাযোগ করবে।`,
            refLabel: "রেফারেন্স",
          }
        : {
            subject: `We received your partner application — ${brand}`,
            eyebrow: "Application received",
            heading: "Thanks for your interest",
            paragraph: `Hi ${a.contact.name}, thanks for applying to partner with ${brand}. Our team will review your application and get back to you.`,
            refLabel: "Reference",
          };
  const built = renderEmail({
    accent: "orange",
    eyebrow: t.eyebrow,
    heading: t.heading,
    paragraphs: [t.paragraph],
    details: {
      rows: [{ label: t.refLabel, value: a.partnerApplicationNumber }],
    },
  });
  await getMailer().send({
    to: a.contact.email,
    subject: t.subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendPartnerDecision(a: IPartnerApplication) {
  const approved = a.status === "approved";
  const built = renderEmail({
    accent: "orange",
    preheader: approved
      ? "Your partner application has been approved."
      : "An update on your partner application.",
    eyebrow: approved ? "Application approved" : "Application update",
    heading: approved
      ? "Your partner application is approved"
      : "Update on your partner application",
    paragraphs: [
      approved
        ? `Good news — your application to partner with ${siteConfig.brand} (${a.partnerApplicationNumber}) has been approved. Our team will reach out with next steps.`
        : `Thank you for your interest in partnering with ${siteConfig.brand}. After review, we're unable to proceed with application ${a.partnerApplicationNumber} at this time.`,
    ],
  });
  await getMailer().send({
    to: a.contact.email,
    subject: approved
      ? `Your partner application ${a.partnerApplicationNumber} is approved`
      : `Update on your partner application ${a.partnerApplicationNumber}`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
