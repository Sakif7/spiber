import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { notifyAdmins } from "./notification.service";
import { type ISellerApplication } from "@/lib/models/seller-application";
import {
  createSellerApplication as repoCreate,
  getSellerApplicationById,
  getOpenApplicationByUser,
} from "@/lib/repositories/seller-applications.repo";
import {
  createSeller,
  getSellerByUserId,
  getSellerBySlug,
} from "@/lib/repositories/sellers.repo";
import { addUserRole } from "@/lib/repositories/users.repo";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { CONTACT } from "@/lib/contact";
import { logger } from "@/lib/log";
import { slugify } from "@/lib/slug";
import { sellerApplicationNumber } from "@/lib/ids";
import {
  SELLER_APP_TRANSITIONS,
  type SellerApplicationCreateInput,
  type SellerApplicationStatus,
} from "@/lib/schemas/seller-application";

function teamRecipient(): string {
  return (
    process.env.KART_TEAM_EMAIL?.trim() ||
    process.env.CONTACT_TEAM_EMAIL?.trim() ||
    CONTACT.generalEmail
  );
}

export type CreateSellerApplicationResult =
  | { ok: true; application: ISellerApplication }
  | { ok: false; code: "already_seller" | "already_applied" };

/** Submit a seller application for a logged-in user. */
export async function createSellerApplication(
  userId: string,
  input: SellerApplicationCreateInput,
): Promise<CreateSellerApplicationResult> {
  await connectToDatabase();
  const existingSeller = await getSellerByUserId(userId);
  if (existingSeller) return { ok: false, code: "already_seller" };
  const open = await getOpenApplicationByUser(userId);
  if (open) return { ok: false, code: "already_applied" };

  const doc = await repoCreate({
    applicationNumber: sellerApplicationNumber(),
    userId: new mongoose.Types.ObjectId(userId),
    businessName: input.businessName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    website: input.website,
    address: input.address,
    categories: input.categories,
    description: input.description,
    bankDetails: input.bankDetails,
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
      type: "seller.application",
      severity: "info",
      title: `New seller application ${record.applicationNumber}`,
      body: record.businessName,
      href: `/admin/sellers/applications/${String(doc._id)}`,
      entity: {
        kind: "SellerApplication",
        id: String(doc._id),
        ref: record.applicationNumber,
      },
    }),
  ]).then((results) => {
    for (const r of results)
      if (r.status === "rejected")
        logger.warn("seller application email failed", r.reason);
  });

  return { ok: true, application: record };
}

export type SellerApplicationTransitionResult =
  | { ok: true; application: ISellerApplication }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionSellerApplication(
  id: string,
  to: SellerApplicationStatus,
  opts: { note?: string; actorId?: string } = {},
): Promise<SellerApplicationTransitionResult> {
  await connectToDatabase();
  const app = await getSellerApplicationById(id);
  if (!app) return { ok: false, code: "not_found" };
  if (!SELLER_APP_TRANSITIONS[app.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }

  // Approving provisions the Seller profile + grants the role (idempotent).
  if (to === "approved" && !app.sellerId) {
    const seller = await provisionSeller(app);
    app.sellerId = seller._id;
    await addUserRole(String(app.userId), "seller").catch((e) =>
      logger.warn("grant seller role failed", e),
    );
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
      logger.warn("seller decision email failed", e),
    );
  }

  return { ok: true, application: app.toObject() };
}

/** Create the Seller profile from an approved application (unique slug). */
async function provisionSeller(app: ISellerApplication) {
  let slug = slugify(app.businessName);
  if (await getSellerBySlug(slug)) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }
  return createSeller({
    userId: app.userId,
    displayName: app.businessName,
    slug,
    bankDetails: app.bankDetails,
    status: "active",
  });
}

async function sendTeamNotification(a: ISellerApplication) {
  const rows: EmailDetailRow[] = [
    { label: "Business", value: a.businessName, strong: true },
    { label: "Contact", value: a.contactName },
    { label: "Email", value: a.email },
    ...(a.phone ? [{ label: "Phone", value: a.phone }] : []),
    ...(a.website ? [{ label: "Website", value: a.website }] : []),
    ...(a.categories ? [{ label: "Sells", value: a.categories }] : []),
    { label: "Ref", value: a.applicationNumber },
  ];
  const built = renderEmail({
    accent: "teal",
    preheader: `New seller application from ${a.businessName}`,
    eyebrow: "New seller application",
    heading: `Seller application: ${a.businessName}`,
    paragraphs: [
      `${a.contactName} applied to sell on Spiber Kart. Review it in the admin panel.`,
      a.description,
    ],
    details: { title: "Application", rows },
  });
  await getMailer().send({
    to: teamRecipient(),
    subject: `New seller application — ${a.businessName} [${a.applicationNumber}]`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendApplicantAck(a: ISellerApplication) {
  const brand = siteConfig.brand;
  const c =
    a.locale === "ja"
      ? {
          subject: `出品申請を受け付けました — ${brand}`,
          eyebrow: "申請を受け付けました",
          heading: "出品申請ありがとうございます",
          paragraph: `${a.contactName} 様、Spiber Kart への出品申請を受け付けました。担当チームが確認し、追ってご連絡いたします。`,
          refLabel: "受付番号",
          outro: `ご不明点は ${CONTACT.phone} までお問い合わせください。`,
        }
      : a.locale === "bn"
        ? {
            subject: `আপনার সেলার আবেদন পেয়েছি — ${brand}`,
            eyebrow: "আবেদন গৃহীত হয়েছে",
            heading: "আবেদনের জন্য ধন্যবাদ",
            paragraph: `প্রিয় ${a.contactName}, স্পাইবার কার্টে বিক্রেতা হওয়ার আবেদনের জন্য ধন্যবাদ। আমাদের টিম যাচাই করে শীঘ্রই আপনার সাথে যোগাযোগ করবে।`,
            refLabel: "রেফারেন্স",
            outro: `প্রশ্ন থাকলে কল করুন ${CONTACT.phone}।`,
          }
        : {
            subject: `We received your seller application — ${brand}`,
            eyebrow: "Application received",
            heading: "Thanks for applying",
            paragraph: `Hi ${a.contactName}, thanks for applying to sell on Spiber Kart. Our team will review your application and get back to you shortly.`,
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
  a: ISellerApplication,
  decision: "approved" | "rejected",
) {
  const brand = siteConfig.brand;
  const approved = decision === "approved";
  const c =
    a.locale === "ja"
      ? approved
        ? {
            subject: `出品申請が承認されました — ${brand}`,
            eyebrow: "承認されました",
            heading: "Spiber Kart へようこそ",
            paragraph: `${a.contactName} 様、出品申請が承認されました。出品者ダッシュボードから商品の登録を開始できます。`,
            outro: `出品者ダッシュボード: ${siteConfig.url}/seller`,
          }
        : {
            subject: `出品申請について — ${brand}`,
            eyebrow: "申請結果",
            heading: "申請ありがとうございました",
            paragraph: `${a.contactName} 様、誠に恐れ入りますが、今回の出品申請は承認に至りませんでした。詳細はお問い合わせください。`,
            outro: `お問い合わせ: ${CONTACT.phone}`,
          }
      : a.locale === "bn"
        ? approved
          ? {
              subject: `আপনার সেলার আবেদন অনুমোদিত হয়েছে — ${brand}`,
              eyebrow: "অনুমোদিত",
              heading: "স্পাইবার কার্টে স্বাগতম",
              paragraph: `প্রিয় ${a.contactName}, আপনার বিক্রেতা আবেদন অনুমোদিত হয়েছে। সেলার ড্যাশবোর্ড থেকে এখনই পণ্য যোগ করা শুরু করুন।`,
              outro: `সেলার ড্যাশবোর্ড: ${siteConfig.url}/seller`,
            }
          : {
              subject: `আপনার সেলার আবেদন সম্পর্কে — ${brand}`,
              eyebrow: "আবেদনের ফলাফল",
              heading: "আবেদনের জন্য ধন্যবাদ",
              paragraph: `প্রিয় ${a.contactName}, দুঃখিত, এই মুহূর্তে আপনার বিক্রেতা আবেদন অনুমোদন করা যায়নি। বিস্তারিত জানতে যোগাযোগ করুন।`,
              outro: `যোগাযোগ: ${CONTACT.phone}`,
            }
        : approved
          ? {
              subject: `Your seller application is approved — ${brand}`,
              eyebrow: "Approved",
              heading: "Welcome to Spiber Kart",
              paragraph: `Hi ${a.contactName}, your seller application has been approved. You can start listing products from your seller dashboard.`,
              outro: `Seller dashboard: ${siteConfig.url}/seller`,
            }
          : {
              subject: `About your seller application — ${brand}`,
              eyebrow: "Application update",
              heading: "Thanks for applying",
              paragraph: `Hi ${a.contactName}, we're sorry — we're unable to approve your seller application at this time. Please contact us for details.`,
              outro: `Contact us: ${CONTACT.phone}`,
            };
  const built = renderEmail({
    accent: approved ? "teal" : "orange",
    preheader: c.paragraph,
    eyebrow: c.eyebrow,
    heading: c.heading,
    paragraphs: [c.paragraph],
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
