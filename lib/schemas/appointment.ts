import { z } from "zod";

/**
 * Appointment — a doctor or teleconsultation BOOKING REQUEST. Manual-first: the
 * patient requests preferred times; an admin confirms and (for teleconsultation)
 * pastes a meeting link (Meet/Jitsi — the "manual" video provider). No live
 * availability. Mirrors the pipeline conventions (state machine + activity).
 */

export const appointmentStatusEnum = z.enum([
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);
export type AppointmentStatus = z.infer<typeof appointmentStatusEnum>;

export const APPOINTMENT_TRANSITIONS: Record<
  AppointmentStatus,
  AppointmentStatus[]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const appointmentTypeEnum = z.enum(["in_person", "teleconsultation"]);
export type AppointmentType = z.infer<typeof appointmentTypeEnum>;

const email = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email(),
);

/** Public submit (rate-limited + honeypot). */
export const appointmentCreateSchema = z.object({
  patient: z.object({
    name: z.string().min(1).max(120),
    email,
    phone: z.string().min(3).max(40),
  }),
  doctorId: z.string().min(1).optional(),
  type: appointmentTypeEnum,
  preferredTimes: z.array(z.string().max(120)).max(10).optional(),
  notes: z.string().max(3000).optional(),
  locale: z.string().max(8).optional(),
  website: z.string().max(200).optional(),
});
export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;

// ---- Admin actions ----
export const appointmentNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type AppointmentNoteInput = z.infer<typeof appointmentNoteSchema>;

export const appointmentAssignSchema = z.object({
  assignedTo: z.string().nullable(),
});
export type AppointmentAssignInput = z.infer<typeof appointmentAssignSchema>;

export const appointmentTransitionSchema = z.object({
  to: appointmentStatusEnum,
  note: z.string().max(1000).optional(),
});
export type AppointmentTransitionInput = z.infer<
  typeof appointmentTransitionSchema
>;

/** Admin confirms + (for teleconsultation) attaches a meeting link. */
export const appointmentMeetingLinkSchema = z.object({
  meetingLink: z.url().max(512),
  scheduledFor: z.coerce.date().optional(),
  note: z.string().max(1000).optional(),
});
export type AppointmentMeetingLinkInput = z.infer<
  typeof appointmentMeetingLinkSchema
>;
