import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { type IAppointment } from "@/lib/models/appointment";
import {
  createAppointment as repoCreateAppointment,
  getAppointmentById,
} from "@/lib/repositories/appointments.repo";
import { getMailer } from "@/lib/mailer";
import {
  renderEmail,
  type EmailDetailRow,
} from "@/lib/mailer/templates/email-layout";
import { siteConfig } from "@/lib/site-config";
import { logger } from "@/lib/log";
import { appointmentNumber } from "@/lib/ids";
import { tourismTeamRecipient } from "./tourism-notify";
import {
  APPOINTMENT_TRANSITIONS,
  type AppointmentCreateInput,
  type AppointmentMeetingLinkInput,
  type AppointmentStatus,
} from "@/lib/schemas/appointment";

export type CreateAppointmentOpts = { userId?: string; locale?: string };

export async function createAppointment(
  input: AppointmentCreateInput,
  opts: CreateAppointmentOpts = {},
): Promise<IAppointment> {
  await connectToDatabase();
  const doc = await repoCreateAppointment({
    appointmentNumber: appointmentNumber(),
    patient: input.patient,
    userId: opts.userId ? new mongoose.Types.ObjectId(opts.userId) : null,
    doctorId:
      input.doctorId && mongoose.isValidObjectId(input.doctorId)
        ? new mongoose.Types.ObjectId(input.doctorId)
        : null,
    type: input.type,
    preferredTimes: input.preferredTimes ?? [],
    notes: input.notes,
    status: "pending",
    activity: [],
  });
  const record = doc.toObject();
  await Promise.allSettled([
    sendAppointmentTeamNotification(record),
    sendAppointmentAck(record, opts.locale),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === "rejected")
        logger.warn("appointment email failed", r.reason);
    }
  });
  return record;
}

export type AppointmentTransitionResult =
  | { ok: true; appointment: IAppointment }
  | { ok: false; code: "not_found" | "invalid_transition" };

export async function transitionAppointment(
  id: string,
  to: AppointmentStatus,
  opts: { note?: string; actorId?: string } = {},
): Promise<AppointmentTransitionResult> {
  await connectToDatabase();
  const appt = await getAppointmentById(id);
  if (!appt) return { ok: false, code: "not_found" };
  if (!APPOINTMENT_TRANSITIONS[appt.status].includes(to)) {
    return { ok: false, code: "invalid_transition" };
  }
  appt.status = to;
  if (opts.note && opts.actorId) {
    appt.activity.push({
      authorId: new mongoose.Types.ObjectId(opts.actorId),
      body: opts.note,
      at: new Date(),
    });
  }
  await appt.save();
  return { ok: true, appointment: appt.toObject() };
}

export type SetMeetingLinkResult =
  | { ok: true; appointment: IAppointment }
  | { ok: false; code: "not_found" };

/** Admin confirms + (for teleconsultation) attaches a meeting link; notifies the patient. */
export async function setAppointmentMeetingLink(
  id: string,
  input: AppointmentMeetingLinkInput,
  actorId?: string,
): Promise<SetMeetingLinkResult> {
  await connectToDatabase();
  const appt = await getAppointmentById(id);
  if (!appt) return { ok: false, code: "not_found" };
  appt.meetingLink = input.meetingLink;
  appt.scheduledFor = input.scheduledFor ?? appt.scheduledFor ?? null;
  if (appt.status === "pending") appt.status = "confirmed";
  if (actorId) {
    appt.activity.push({
      authorId: new mongoose.Types.ObjectId(actorId),
      body: input.note
        ? `Meeting link added: ${input.note}`
        : "Meeting link added; appointment confirmed.",
      at: new Date(),
    });
  }
  await appt.save();
  await sendAppointmentScheduled(appt.toObject()).catch((e) =>
    logger.warn("appointment scheduled email failed", e),
  );
  return { ok: true, appointment: appt.toObject() };
}

// ----------------------------------------------------------------- emails
async function sendAppointmentTeamNotification(a: IAppointment) {
  const rows: EmailDetailRow[] = [
    { label: "Patient", value: a.patient.name, strong: true },
    { label: "Email", value: a.patient.email },
    { label: "Phone", value: a.patient.phone },
    {
      label: "Type",
      value: a.type === "teleconsultation" ? "Teleconsultation" : "In-person",
    },
    { label: "Reference", value: a.appointmentNumber },
  ];
  if (a.preferredTimes.length) {
    rows.push({ label: "Preferred", value: a.preferredTimes.join(", ") });
  }
  const built = renderEmail({
    accent: "orange",
    preheader: `New appointment request from ${a.patient.name}`,
    eyebrow: "New appointment request",
    heading: "A new appointment request was submitted",
    paragraphs: [
      `${a.patient.name} requested ${a.type === "teleconsultation" ? "a teleconsultation" : "an appointment"}. Confirm a time${a.type === "teleconsultation" ? " and add a meeting link" : ""} from the appointments queue.`,
      a.notes ?? "",
    ].filter(Boolean),
    details: { title: "Request", rows },
  });
  await getMailer().send({
    to: tourismTeamRecipient(),
    subject: `New appointment — ${a.patient.name} [${a.appointmentNumber}]`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendAppointmentAck(a: IAppointment, locale?: string) {
  const brand = siteConfig.brand;
  const t =
    locale === "ja"
      ? {
          subject: `予約リクエストを受け付けました — ${brand}`,
          eyebrow: "リクエストを受け付けました",
          heading: "ご依頼ありがとうございます",
          paragraph: `${a.patient.name}様、予約リクエストを受け付けました。日時を確定のうえ、まもなくご連絡いたします。`,
          refLabel: "参照番号",
        }
      : locale === "bn"
        ? {
            subject: `আপনার অ্যাপয়েন্টমেন্ট অনুরোধ পেয়েছি — ${brand}`,
            eyebrow: "অনুরোধ গৃহীত",
            heading: "আপনার অনুরোধের জন্য ধন্যবাদ",
            paragraph: `প্রিয় ${a.patient.name}, আমরা আপনার অ্যাপয়েন্টমেন্ট অনুরোধ পেয়েছি। আমরা সময় নিশ্চিত করে শীঘ্রই আপনাকে জানাবো।`,
            refLabel: "রেফারেন্স",
          }
        : {
            subject: `We received your appointment request — ${brand}`,
            eyebrow: "Request received",
            heading: "Thanks for your request",
            paragraph: `Hi ${a.patient.name}, we've received your appointment request. We'll confirm a time and get back to you shortly.`,
            refLabel: "Reference",
          };
  const built = renderEmail({
    accent: "orange",
    eyebrow: t.eyebrow,
    heading: t.heading,
    paragraphs: [t.paragraph],
    details: { rows: [{ label: t.refLabel, value: a.appointmentNumber }] },
  });
  await getMailer().send({
    to: a.patient.email,
    subject: t.subject,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}

async function sendAppointmentScheduled(a: IAppointment) {
  const rows: EmailDetailRow[] = [
    { label: "Reference", value: a.appointmentNumber },
  ];
  if (a.scheduledFor) {
    rows.push({
      label: "Scheduled for",
      value: new Date(a.scheduledFor).toLocaleString("en-US"),
      strong: true,
    });
  }
  const built = renderEmail({
    accent: "orange",
    preheader: "Your appointment is confirmed.",
    eyebrow: "Appointment confirmed",
    heading: "Your appointment is confirmed",
    paragraphs: [
      `Your ${a.type === "teleconsultation" ? "teleconsultation" : "appointment"} (${a.appointmentNumber}) is confirmed.${a.type === "teleconsultation" ? " Use the button below to join at the scheduled time." : ""}`,
    ],
    details: { title: "Appointment", rows },
    button: a.meetingLink
      ? { label: "Join the consultation", url: a.meetingLink }
      : undefined,
  });
  await getMailer().send({
    to: a.patient.email,
    subject: `Your appointment ${a.appointmentNumber} is confirmed`,
    html: built.html,
    text: built.text,
    attachments: built.attachments,
  });
}
