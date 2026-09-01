import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { notifyAdmins } from "./notification.service";
import { type ICreditApplication } from "@/lib/models/credit-application";
import { DEFAULT_CREDIT_TERMS_DAYS } from "@/lib/models/credit-account";
import {
  createCreditApplication as repoCreate,
  getCreditApplicationById,
  getOpenCreditApplicationByUser,
} from "@/lib/repositories/credit-applications.repo";
import {
  createCreditAccount,
  getCreditAccountByUserId,
} from "@/lib/repositories/credit-accounts.repo";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { CONTACT } from "@/lib/contact";
import { formatBDT } from "@/lib/money";
import { logger } from "@/lib/log";
import { creditApplicationNumber } from "@/lib/ids";
import {
  CREDIT_APP_TRANSITIONS,
  type CreditApplicationCreateInput,
  type CreditApplicationStatus,
} from "@/lib/schemas/credit";

function teamRecipient(): string {
  return (
    process.env.MEDTRADE_TEAM_EMAIL?.trim() ||
    process.env.CONTACT_TEAM_EMAIL?.trim() ||
    CONTACT.generalEmail
  );
}

export type CreateCreditApplicationResult =
  | { ok: true; application: ICreditApplication }
  | { ok: false; code: "already_enlisted" | "already_applied" };

/**
 * Submit a credit-facility application for a logged-in user.
 *
 * A user with ANY live account is blocked, including a suspended one — a
 * suspension is a decision to revisit with the team, not something to re-apply
 * around.
 */
export async function createCreditApplication(
  userId: string,
  input: CreditApplicationCreateInput,
): Promise<CreateCreditApplicationResult> {
  await connectToDatabase();
  const existing = await getCreditAccountByUserId(userId);
  if (existing) return { ok: false, code: "already_enlisted" };
  const open = await getOpenCreditApplicationByUser(userId);
  if (open) return { ok: false, code: "already_applied" };

  const doc = await repoCreate({
    applicationNumber: creditApplicationNumber(),
    userId: new mongoose.Types.ObjectId(userId),
    organization: input.organization,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    address: input.address,
    organizationType: input.organizationType,
    tradeLicenseNo: input.tradeLicenseNo,
    tinNumber: input.tinNumber,
    binNumber: input.binNumber,
    expectedMonthlyVolumeMinor: input.expectedMonthlyVolumeMinor ?? null,
    description: input.description,
    documents: input.documents ?? [],
    termsAcceptedAt: new Date(),
    locale: input.locale,
    status: "new",
    activity: [],
  });
  const record = doc.toObject();

  await Promise.allSettled([
    sendTeamNotification(record),
    sendApplicantAck(record),
    notifyAdmins({
      type: "credit.application",
      severity: "info",
      title: `New credit application ${record.applicationNumber}`,
      body: record.organization,
      href: `/admin/credit/applications/${String(doc._id)}`,
      entity: {
        kind: "CreditApplication",
        id: String(doc._id),
        ref: record.applicationNumber,
      },
    }),
  ]).then((results) => {
    for (const r of results)
      if (r.status === "rejected")
        logger.warn("credit application email failed", r.reason);
  });

  return { ok: true, application: record };
}

export type CreditApplicationTransitionResult =
  | { ok: true; application: ICreditApplication }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionCreditApplication(
  id: string,
  to: CreditApplicationStatus,
  opts: { note?: string; actorId?: string; termsDays?: number } = {},
): Promise<CreditApplicationTransitionResult> {
  await connectToDatabase();
  const app = await getCreditApplicationById(id);
  if (!app) return { ok: false, code: "not_found" };
  if (!CREDIT_APP_TRANSITIONS[app.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }

  // Approving provisions the credit account. The `creditAccountId` guard plus
  // the userId partial-unique index make a double-approve idempotent.
  if (to === "approved" && !app.creditAccountId) {
    const account = await provisionCreditAccount(app, {
      termsDays: opts.termsDays,
      approvedBy: opts.actorId,
    });
    app.creditAccountId = account._id as mongoose.Types.ObjectId;
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
    await sendDecisionEmail(app.toObject(), to).catch((e) =>
      logger.warn("credit decision email failed", e),
    );
  }

  return { ok: true, application: app.toObject() };
}

/**
 * Create the CreditAccount from an approved application. If a live account
 * already exists (a concurrent approve won the race, caught by the unique
 * index), adopt it rather than failing the transition.
 */
async function provisionCreditAccount(
  // Hydrated doc: ICreditApplication is the schema shape, the doc adds _id.
  app: ICreditApplication & { _id: mongoose.Types.ObjectId },
  opts: { termsDays?: number; approvedBy?: string },
) {
  const data = {
    userId: app.userId,
    organization: app.organization,
    termsDays: opts.termsDays ?? DEFAULT_CREDIT_TERMS_DAYS,
    status: "active" as const,
    applicationId: app._id,
    approvedBy: opts.approvedBy
      ? new mongoose.Types.ObjectId(opts.approvedBy)
      : null,
  };
  try {
    return await createCreditAccount(data);
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      const winner = await getCreditAccountByUserId(String(app.userId));
      if (winner) return winner;
    }
    throw err;
  }
}

async function sendTeamNotification(a: ICreditApplication) {
  const rows: EmailDetailRow[] = [
    { label: "Organization", value: a.organization, strong: true },
    { label: "Contact", value: a.contactName },
    { label: "Email", value: a.email },
    ...(a.phone ? [{ label: "Phone", value: a.phone }] : []),
    ...(a.organizationType
      ? [{ label: "Type", value: a.organizationType }]
      : []),
    ...(a.tradeLicenseNo
      ? [{ label: "Trade licence", value: a.tradeLicenseNo }]
      : []),
    ...(a.binNumber ? [{ label: "BIN", value: a.binNumber }] : []),
    ...(a.expectedMonthlyVolumeMinor
      ? [
          {
            label: "Expected monthly volume",
            value: formatBDT(a.expectedMonthlyVolumeMinor),
          },
        ]
      : []),
    { label: "Documents", value: String(a.documents.length) },
    { label: "Ref", value: a.applicationNumber },
  ];
  const built = renderEmail({
    accent: "teal",
    preheader: `New credit application from ${a.organization}`,
    eyebrow: "New credit application",
    heading: `Credit facility: ${a.organization}`,
    paragraphs: [
      `${a.contactName} applied for a Medtrade credit facility. Review the documents in the admin panel.`,
      a.description,
    ],
    details: { title: "Application", rows },
  });
  await getMailer().send({
    to: teamRecipient(),
    subject: `New credit application — ${a.organization} [${a.applicationNumber}]`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendApplicantAck(a: ICreditApplication) {
  const brand = siteConfig.brand;
  const c =
    a.locale === "ja"
      ? {
          subject: `与信申請を受け付けました — ${brand}`,
          eyebrow: "申請を受け付けました",
          heading: "与信申請ありがとうございます",
          paragraph: `${a.contactName} 様、Spiber Medtrade の掛売（与信）申請を受け付けました。担当チームが書類を確認し、追ってご連絡いたします。`,
          refLabel: "受付番号",
          outro: `ご不明点は ${CONTACT.phone} までお問い合わせください。`,
        }
      : a.locale === "bn"
        ? {
            subject: `আপনার ক্রেডিট আবেদন পেয়েছি — ${brand}`,
            eyebrow: "আবেদন গৃহীত হয়েছে",
            heading: "আবেদনের জন্য ধন্যবাদ",
            paragraph: `প্রিয় ${a.contactName}, স্পাইবার মেডট্রেডে ক্রেডিট সুবিধার আবেদনের জন্য ধন্যবাদ। আমাদের টিম কাগজপত্র যাচাই করে শীঘ্রই আপনার সাথে যোগাযোগ করবে।`,
            refLabel: "রেফারেন্স",
            outro: `প্রশ্ন থাকলে কল করুন ${CONTACT.phone}।`,
          }
        : {
            subject: `We received your credit application — ${brand}`,
            eyebrow: "Application received",
            heading: "Thanks for applying",
            paragraph: `Hi ${a.contactName}, thanks for applying for a Spiber Medtrade credit facility. Our team will verify your documents and get back to you shortly.`,
            refLabel: "Reference",
            outro: `Questions? Call us at ${CONTACT.phone}.`,
          };
  const built = renderEmail({
    accent: "teal",
    preheader: c.paragraph,
    eyebrow: c.eyebrow,
    heading: c.heading,
    paragraphs: [c.paragraph],
    details: { rows: [{ label: c.refLabel, value: a.applicationNumber }] },
    outro: [c.outro],
  });
  await getMailer().send({
    to: a.email,
    subject: c.subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendDecisionEmail(
  a: ICreditApplication,
  decision: "approved" | "rejected",
) {
  const brand = siteConfig.brand;
  const approved = decision === "approved";
  const c =
    a.locale === "ja"
      ? approved
        ? {
            subject: `与信申請が承認されました — ${brand}`,
            eyebrow: "承認されました",
            heading: "掛売のご利用が可能になりました",
            paragraph: `${a.contactName} 様、与信申請が承認されました。Medtrade のご注文時に「クレジット口座」をお選びいただけます。`,
            outro: `Medtrade: ${siteConfig.url}/ja/medtrade`,
          }
        : {
            subject: `与信申請について — ${brand}`,
            eyebrow: "申請結果",
            heading: "申請ありがとうございました",
            paragraph: `${a.contactName} 様、誠に恐れ入りますが、今回の与信申請は承認に至りませんでした。代金引換は引き続きご利用いただけます。詳細はお問い合わせください。`,
            outro: `お問い合わせ: ${CONTACT.phone}`,
          }
      : a.locale === "bn"
        ? approved
          ? {
              subject: `আপনার ক্রেডিট আবেদন অনুমোদিত — ${brand}`,
              eyebrow: "অনুমোদিত",
              heading: "ক্রেডিট সুবিধা চালু হয়েছে",
              paragraph: `প্রিয় ${a.contactName}, আপনার ক্রেডিট আবেদন অনুমোদিত হয়েছে। এখন মেডট্রেডে অর্ডারের সময় "ক্রেডিট অ্যাকাউন্ট" বেছে নিতে পারবেন।`,
              outro: `মেডট্রেড: ${siteConfig.url}/bn/medtrade`,
            }
          : {
              subject: `আপনার ক্রেডিট আবেদন প্রসঙ্গে — ${brand}`,
              eyebrow: "আবেদনের ফলাফল",
              heading: "আবেদনের জন্য ধন্যবাদ",
              paragraph: `প্রিয় ${a.contactName}, দুঃখিত, এই মুহূর্তে আমরা আপনার ক্রেডিট আবেদন অনুমোদন করতে পারিনি। ক্যাশ অন ডেলিভারিতে অর্ডার চালু আছে। বিস্তারিত জানতে যোগাযোগ করুন।`,
              outro: `যোগাযোগ: ${CONTACT.phone}`,
            }
        : approved
          ? {
              subject: `Your credit facility is approved — ${brand}`,
              eyebrow: "Approved",
              heading: "Your credit facility is open",
              paragraph: `Hi ${a.contactName}, your credit application has been approved. You can now choose "Credit account" at Medtrade checkout and pay on agreed terms.`,
              outro: `Start ordering: ${siteConfig.url}/en/medtrade`,
            }
          : {
              subject: `About your credit application — ${brand}`,
              eyebrow: "Application outcome",
              heading: "Thanks for applying",
              paragraph: `Hi ${a.contactName}, we weren't able to approve a credit facility at this time. You can still order on Medtrade with cash on delivery. Get in touch if you'd like to discuss it.`,
              outro: `Questions? Call us at ${CONTACT.phone}.`,
            };
  const built = renderEmail({
    accent: approved ? "teal" : "orange",
    preheader: c.paragraph,
    eyebrow: c.eyebrow,
    heading: c.heading,
    paragraphs: [c.paragraph],
    details: { rows: [{ label: "Reference", value: a.applicationNumber }] },
    outro: [c.outro],
  });
  await getMailer().send({
    to: a.email,
    subject: c.subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
