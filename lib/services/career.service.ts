import { slugify } from "@/lib/slug";
import { jobApplicationNumber } from "@/lib/ids";
import {
  createJob,
  updateJob,
  getJobByIdLean,
  createApplication as repoCreateApplication,
} from "@/lib/repositories/career.repo";
import type { JobInput, JobApplicationCreateInput } from "@/lib/schemas/career";
import type { IJobPosting } from "@/lib/models/jobPosting";
import type { IJobApplication } from "@/lib/models/jobApplication";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { CONTACT } from "@/lib/contact";
import { logger } from "@/lib/log";

// ───────────────────────── Jobs ─────────────────────────
export type SaveJobResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; code: "duplicate" | "not_found" };

function isDuplicateKeyError(e: unknown): boolean {
  return (e as { code?: number } | null)?.code === 11000;
}

export async function saveJob(
  input: JobInput,
  id?: string,
): Promise<SaveJobResult> {
  const slug = slugify(input.slug || input.title.en);
  const data: Partial<IJobPosting> = {
    title: input.title,
    slug,
    department: input.department,
    reportsTo: input.reportsTo,
    location: input.location,
    employmentType: input.employmentType,
    experience: input.experience,
    vacancies: input.vacancies ?? null,
    summary: input.summary,
    description: input.description,
    responsibilities: input.responsibilities,
    requirements: input.requirements,
    preferredSkills: input.preferredSkills,
    benefits: input.benefits,
    applyEmail: input.applyEmail || undefined,
    recruiterName: input.recruiterName || undefined,
    recruiterTitle: input.recruiterTitle,
    recruiterEmail: input.recruiterEmail || undefined,
    recruiterPhone: input.recruiterPhone || undefined,
    closesAt: input.closesAt ?? null,
    status: input.status,
  };
  try {
    if (id) {
      const updated = await updateJob(id, data);
      if (!updated) return { ok: false, code: "not_found" };
      return { ok: true, id: String(updated._id), slug: updated.slug };
    }
    const created = await createJob(data);
    return { ok: true, id: String(created._id), slug: created.slug };
  } catch (e) {
    if (isDuplicateKeyError(e)) return { ok: false, code: "duplicate" };
    throw e;
  }
}

// ───────────────────────── Applications ─────────────────────────
export type ApplicationMeta = { ip?: string; userAgent?: string };

export type CreateApplicationResult =
  | { ok: true; applicationNumber: string }
  | { ok: false; code: "job_unavailable" };

/** Where new job applications are routed (overridable via env). */
function careersRecipient(): string {
  return process.env.CAREERS_EMAIL?.trim() || CONTACT.generalEmail;
}

/**
 * Persist a job application, notify the HR inbox (with a link to the gated
 * résumé + admin record), and send the applicant a localized acknowledgement.
 * Mirrors the contact pipeline: the job must still be open, and email failures
 * are logged but never fail the request.
 */
export async function createApplication(
  input: JobApplicationCreateInput,
  meta?: ApplicationMeta,
): Promise<CreateApplicationResult> {
  const job = await getJobByIdLean(input.jobId);
  if (!job || job.status !== "open") {
    return { ok: false, code: "job_unavailable" };
  }

  const doc = await repoCreateApplication({
    applicationNumber: jobApplicationNumber(),
    jobId: String(job._id),
    jobTitle: job.title.en,
    name: input.name,
    email: input.email,
    phone: input.phone,
    coverLetter: input.coverLetter,
    resumeKey: input.resumeKey,
    resumeName: input.resumeName,
    status: "new",
    locale: input.locale,
    meta: meta && (meta.ip || meta.userAgent) ? meta : undefined,
  });
  const record = doc.toObject();
  const id = String(doc._id);

  await Promise.allSettled([
    sendTeamNotification(record, job.title.en, id),
    sendApplicantAck(record, job.title.en),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected") {
        logger.warn("career application email failed", r.reason);
      }
    }
  });

  return { ok: true, applicationNumber: record.applicationNumber };
}

async function sendTeamNotification(
  app: IJobApplication,
  jobTitle: string,
  id: string,
) {
  const adminUrl = `${siteConfig.url}/en/admin/career/applications/${id}`;
  const rows: EmailDetailRow[] = [
    { label: "Applicant", value: app.name, strong: true },
    { label: "Email", value: app.email },
    { label: "Phone", value: app.phone },
    { label: "Position", value: jobTitle },
    { label: "Reference", value: app.applicationNumber },
  ];
  const built = renderEmail({
    accent: "teal",
    preheader: `New application from ${app.name} for ${jobTitle}`,
    eyebrow: "New job application",
    heading: `New application — ${jobTitle}`,
    paragraphs: [
      `${app.name} applied via the careers page. Reply to ${app.email} or call ${app.phone}.`,
      ...(app.coverLetter ? [app.coverLetter] : []),
      "Open the application in the admin panel to download the résumé and update its status.",
    ],
    details: { title: "Applicant", rows },
    button: { label: "View application", url: adminUrl },
  });
  await getMailer().send({
    to: careersRecipient(),
    subject: `New application — ${jobTitle} — ${app.name} [${app.applicationNumber}]`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendApplicantAck(app: IJobApplication, jobTitle: string) {
  const bn = app.locale === "bn";
  const brand = siteConfig.brand;
  const c = bn
    ? {
        subject: `আপনার আবেদন পেয়েছি — ${brand}`,
        preheader: "আমরা আপনার আবেদন পেয়েছি।",
        eyebrow: "আবেদন গৃহীত হয়েছে",
        heading: "আবেদনের জন্য ধন্যবাদ",
        paragraph: `প্রিয় ${app.name}, “${jobTitle}” পদে আবেদন করার জন্য ধন্যবাদ। আমরা আপনার আবেদন পেয়েছি এবং আমাদের টিম তা পর্যালোচনা করবে। আপনার প্রোফাইল উপযুক্ত হলে আমরা যোগাযোগ করব।`,
        posLabel: "পদ",
        refLabel: "রেফারেন্স",
        outro: `যেকোনো প্রশ্নে আমাদের কল করুন ${CONTACT.phone} (সোম–শনি, ০৯:০০–১৮:০০ BST)।`,
      }
    : {
        subject: `We received your application — ${brand}`,
        preheader: "We've received your application.",
        eyebrow: "Application received",
        heading: "Thanks for applying",
        paragraph: `Hi ${app.name}, thanks for applying for the “${jobTitle}” position at ${brand}. We've received your application and our team will review it. If your profile is a good fit, we'll be in touch.`,
        posLabel: "Position",
        refLabel: "Reference",
        outro: `If you have any questions, call us at ${CONTACT.phone} (Mon–Sat, 09:00–18:00 BST).`,
      };

  const built = renderEmail({
    accent: "teal",
    preheader: c.preheader,
    eyebrow: c.eyebrow,
    heading: c.heading,
    paragraphs: [c.paragraph],
    details: {
      rows: [
        { label: c.posLabel, value: jobTitle },
        { label: c.refLabel, value: app.applicationNumber },
      ],
    },
    outro: [c.outro],
  });
  await getMailer().send({
    to: app.email,
    subject: c.subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
