import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { type IMedicalCase } from "@/lib/models/medicalCase";
import {
  createMedicalCase as repoCreateMedicalCase,
  getMedicalCaseById,
  setMedicalCaseChecklistItem,
} from "@/lib/repositories/medicalCases.repo";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { CONTACT } from "@/lib/contact";
import { logger } from "@/lib/log";
import { medicalCaseNumber } from "@/lib/ids";
import { tourismTeamRecipient } from "./tourism-notify";
import {
  MEDICAL_CASE_TRANSITIONS,
  type ChecklistKey,
  type MedicalCaseCreateInput,
  type MedicalCaseQuoteInput,
  type MedicalCaseStatus,
} from "@/lib/schemas/medical-case";

export type CreateMedicalCaseOpts = { userId?: string; locale?: string };

/**
 * Create a medical case (submit-with-reports). Documents are already-uploaded
 * PRIVATE storage keys (Stage B upload endpoint). Sends the patient a localized
 * acknowledgement + notifies the case-manager inbox. Email failures never fail
 * the request.
 */
export async function createMedicalCase(
  input: MedicalCaseCreateInput,
  opts: CreateMedicalCaseOpts = {},
): Promise<IMedicalCase> {
  await connectToDatabase();
  const now = new Date();
  const doc = await repoCreateMedicalCase({
    caseNumber: medicalCaseNumber(),
    patient: input.patient,
    userId: opts.userId ? new mongoose.Types.ObjectId(opts.userId) : null,
    diagnosis: input.diagnosis,
    requestedService: input.requestedService,
    documents: (input.documents ?? []).map((d) => ({
      name: d.name,
      fileKey: d.fileKey,
      contentType: d.contentType,
      uploadedAt: now,
    })),
    hospitalId:
      input.hospitalId && mongoose.isValidObjectId(input.hospitalId)
        ? new mongoose.Types.ObjectId(input.hospitalId)
        : null,
    doctorId:
      input.doctorId && mongoose.isValidObjectId(input.doctorId)
        ? new mongoose.Types.ObjectId(input.doctorId)
        : null,
    packageId:
      input.packageId && mongoose.isValidObjectId(input.packageId)
        ? new mongoose.Types.ObjectId(input.packageId)
        : null,
    status: "new",
    quotation: null,
    activity: [],
    consentAcceptedAt: now,
  });
  const record = doc.toObject();
  await Promise.allSettled([
    sendCaseTeamNotification(record),
    sendCaseAck(record, opts.locale),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected")
        logger.warn("medical-case email failed", r.reason);
    }
  });
  return record;
}

export type MedicalCaseTransitionResult =
  | { ok: true; case: IMedicalCase }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionMedicalCase(
  id: string,
  to: MedicalCaseStatus,
  opts: { note?: string; actorId?: string } = {},
): Promise<MedicalCaseTransitionResult> {
  await connectToDatabase();
  const medicalCase = await getMedicalCaseById(id);
  if (!medicalCase) return { ok: false, code: "not_found" };
  if (!MEDICAL_CASE_TRANSITIONS[medicalCase.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }
  medicalCase.status = to;
  if (opts.note && opts.actorId) {
    medicalCase.activity.push({
      authorId: new mongoose.Types.ObjectId(opts.actorId),
      body: opts.note,
      at: new Date(),
    });
  }
  await medicalCase.save();
  return { ok: true, case: medicalCase.toObject() };
}

export type SetCaseQuotationResult =
  | { ok: true; case: IMedicalCase }
  | { ok: false; code: "not_found" };

/**
 * Case manager attaches the hospital quotation (amount/validity/notes — rendered
 * on demand as a printable view, no stored PDF). Entering a quote on a case in
 * `reviewing` advances it to `quoted` and emails the patient.
 */
export async function setCaseQuotation(
  id: string,
  input: MedicalCaseQuoteInput,
  actorId?: string,
): Promise<SetCaseQuotationResult> {
  await connectToDatabase();
  const medicalCase = await getMedicalCaseById(id);
  if (!medicalCase) return { ok: false, code: "not_found" };

  medicalCase.quotation = {
    amountMinor: input.amountMinor ?? null,
    validUntil: input.validUntil ?? null,
    notes: input.notes ?? null,
    sentAt: new Date(),
  };
  if (medicalCase.status === "reviewing") medicalCase.status = "quoted";
  if (actorId) {
    medicalCase.activity.push({
      authorId: new mongoose.Types.ObjectId(actorId),
      body: input.notes ? `Quotation sent: ${input.notes}` : "Quotation sent.",
      at: new Date(),
    });
  }
  await medicalCase.save();
  await sendCaseQuoteReady(medicalCase.toObject()).catch((e) =>
    logger.warn("case quote email failed", e),
  );
  return { ok: true, case: medicalCase.toObject() };
}

export type ChecklistResult =
  | { ok: true; case: IMedicalCase }
  | { ok: false; code: "not_found" };

/** Toggle an arrangement-checklist item (appointment/visa/air ticket/…). */
export async function setMedicalCaseChecklist(
  id: string,
  key: ChecklistKey,
  done: boolean,
  note: string | undefined,
  actorId?: string,
): Promise<ChecklistResult> {
  await connectToDatabase();
  const updated = await setMedicalCaseChecklistItem(id, key, done, note);
  if (!updated) return { ok: false, code: "not_found" };
  if (actorId) {
    updated.activity.push({
      authorId: new mongoose.Types.ObjectId(actorId),
      body: `Checklist · ${key} marked ${done ? "done" : "pending"}${note ? ` — ${note}` : ""}`,
      at: new Date(),
    });
    await updated.save();
  }
  return { ok: true, case: updated.toObject() };
}

// ----------------------------------------------------------------- emails
function fullName(c: IMedicalCase) {
  return c.patient.name;
}

async function sendCaseTeamNotification(c: IMedicalCase) {
  const rows: EmailDetailRow[] = [
    { label: "Patient", value: fullName(c), strong: true },
    { label: "Country", value: c.patient.country },
    { label: "Email", value: c.patient.email },
    { label: "Phone", value: c.patient.phone },
    { label: "Reference", value: c.caseNumber },
    { label: "Documents", value: String(c.documents.length) },
  ];
  if (c.requestedService) {
    rows.push({ label: "Requested", value: c.requestedService });
  }
  const built = renderEmail({
    accent: "orange",
    preheader: `New medical case from ${fullName(c)}`,
    eyebrow: "New medical case",
    heading: "A new medical case was submitted",
    paragraphs: [
      `${fullName(c)} (${c.patient.country}) submitted a medical case via the website. Review it in the case-management board and assign a case manager.`,
      c.diagnosis ? `Diagnosis / notes: ${c.diagnosis}` : "",
    ].filter(Boolean),
    details: { title: "Case", rows },
  });
  await getMailer().send({
    to: tourismTeamRecipient(),
    subject: `New medical case — ${fullName(c)} [${c.caseNumber}]`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendCaseAck(c: IMedicalCase, locale?: string) {
  const brand = siteConfig.brand;
  const t =
    locale === "ja"
      ? {
          subject: `医療ケースを受け付けました — ${brand}`,
          preheader: "ケースを受け付けました。まもなく確認いたします。",
          eyebrow: "ケースを受け付けました",
          heading: "ご依頼ありがとうございます",
          paragraph: `${fullName(c)} 様、${brand} Tourism にお問い合わせいただきありがとうございます。医療ケースおよび診断書を受け付けました。担当のケースマネージャーが内容を確認のうえ、まもなくご連絡いたします。`,
          refLabel: "参照番号",
          privacy:
            "お客様の診断書は安全に保管されており、担当のケースマネージャーおよび権限のあるスタッフのみが閲覧できます。",
          outro: `お急ぎの場合は ${CONTACT.phone} までお電話ください。`,
        }
      : locale === "bn"
        ? {
            subject: `আপনার মেডিকেল কেস পেয়েছি — ${brand}`,
            preheader: "আমরা আপনার কেস পেয়েছি এবং শীঘ্রই পর্যালোচনা করব।",
            eyebrow: "কেস গৃহীত হয়েছে",
            heading: "আপনার অনুরোধের জন্য ধন্যবাদ",
            paragraph: `প্রিয় ${fullName(c)}, ${brand} ট্যুরিজমে যোগাযোগ করার জন্য ধন্যবাদ। আমরা আপনার মেডিকেল কেস ও রিপোর্ট পেয়েছি। আমাদের কেস ম্যানেজার এটি পর্যালোচনা করে শীঘ্রই আপনার সাথে যোগাযোগ করবেন।`,
            refLabel: "রেফারেন্স",
            privacy:
              "আপনার মেডিকেল রিপোর্ট গোপনীয়ভাবে সংরক্ষিত — শুধুমাত্র আপনার নির্ধারিত কেস ম্যানেজার ও অনুমোদিত স্টাফ এগুলো দেখতে পারবেন।",
            outro: `জরুরি প্রয়োজনে কল করুন ${CONTACT.phone}।`,
          }
        : {
            subject: `We received your medical case — ${brand}`,
            preheader: "We've received your case and will review it shortly.",
            eyebrow: "Case received",
            heading: "Thanks for your request",
            paragraph: `Hi ${fullName(c)}, thanks for contacting ${brand} Tourism. We've received your medical case and reports. Our case manager will review everything and get back to you shortly.`,
            refLabel: "Reference",
            privacy:
              "Your medical reports are stored securely — only your assigned case manager and authorised staff can view them.",
            outro: `If it's urgent, call us at ${CONTACT.phone}.`,
          };
  const built = renderEmail({
    accent: "orange",
    preheader: t.preheader,
    eyebrow: t.eyebrow,
    heading: t.heading,
    paragraphs: [t.paragraph],
    details: { rows: [{ label: t.refLabel, value: c.caseNumber }] },
    outro: [t.privacy, t.outro],
  });
  await getMailer().send({
    to: c.patient.email,
    subject: t.subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendCaseQuoteReady(c: IMedicalCase) {
  const rows: EmailDetailRow[] = [{ label: "Reference", value: c.caseNumber }];
  if (c.quotation?.amountMinor != null) {
    const { formatBDT } = await import("@/lib/money");
    rows.push({
      label: "Estimated total",
      value: formatBDT(c.quotation.amountMinor),
      strong: true,
    });
  }
  if (c.quotation?.validUntil) {
    rows.push({
      label: "Valid until",
      value: new Date(c.quotation.validUntil).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    });
  }
  const built = renderEmail({
    accent: "orange",
    preheader: "Your treatment quotation is ready.",
    eyebrow: "Quotation ready",
    heading: "Your treatment quotation is ready",
    paragraphs: [
      `We've prepared a quotation for your case ${c.caseNumber}. ${c.quotation?.notes ?? ""}`.trim(),
    ],
    details: { title: "Quotation", rows },
    button: {
      label: "View your case",
      url: `${siteConfig.url}/en/account/cases`,
    },
  });
  await getMailer().send({
    to: c.patient.email,
    subject: `Your quotation for case ${c.caseNumber} is ready`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
