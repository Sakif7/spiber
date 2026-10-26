import { z } from "zod";
import { MAIL_LOCAL_PART } from "@/lib/mail/address";
import { canStartOn, CYCLE_LIMITS, isDayKey } from "@/lib/hr/cycles";

/** Employees and payroll. */

export const employeeKindEnum = z.enum(["director", "staff"]);
export const paySchemeEnum = z.enum(["revenue_share", "fixed", "none"]);
export type PayScheme = z.infer<typeof paySchemeEnum>;

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "must be an id");
const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "must be a month, e.g. 2026-08");
/** A calendar day, as the date input sends it. */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date")
  .refine(isDayKey, "must be a real date");

const bounded = (kind: keyof typeof CYCLE_LIMITS) =>
  z.number().int().min(CYCLE_LIMITS[kind].min).max(CYCLE_LIMITS[kind].max);

/** How a stretch of time is cut into periods — see `lib/hr/cycles.ts`. */
export const cycleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("months"), every: bounded("months") }),
  z.object({
    kind: z.literal("semi_monthly"),
    splitDay: bounded("semi_monthly"),
  }),
  z.object({ kind: z.literal("weeks"), every: bounded("weeks") }),
  z.object({ kind: z.literal("days"), every: bounded("days") }),
]);

/**
 * A cycle and the day it takes over. Months begin on the 1st and the halves
 * of a month on the 1st or the split day, so a period is never born crooked.
 */
export const cycleChangeSchema = z
  .object({ from: day, cycle: cycleSchema })
  .refine((v) => canStartOn(v.cycle, v.from), {
    message: "this cycle cannot start on that day",
    path: ["from"],
  });
export type CycleChangeInput = z.infer<typeof cycleChangeSchema>;

export const employeeBankSchema = z.object({
  bankName: z.string().trim().max(120).optional().or(z.literal("")),
  branch: z.string().trim().max(120).optional().or(z.literal("")),
  accountName: z.string().trim().max(160).optional().or(z.literal("")),
  accountNumber: z.string().trim().max(60).optional().or(z.literal("")),
  routingNumber: z.string().trim().max(60).optional().or(z.literal("")),
});

export const employeeCreateSchema = z.object({
  name: z.string().trim().min(1, "is required").max(160),
  designation: z.string().trim().min(1, "is required").max(160),
  kind: employeeKindEnum.default("director"),
  payScheme: paySchemeEnum.default("revenue_share"),
  email: z.email("must be a valid email").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  userId: objectId.nullish(),
  joinedAt: z.iso.datetime(),
  leftAt: z.iso.datetime().nullish(),
  status: z.enum(["active", "inactive"]).default("active"),
  fixedMonthlyMinor: z.number().int().min(0).nullish(),
  bankDetails: employeeBankSchema.optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  /** Their pay schedule; null or absent is the company's default schedule. */
  payScheduleId: objectId.nullish(),
  /** Convenience: allocate the opening shareholding while creating the record. */
  shares: z.number().int().min(0).max(1_000_000).optional(),
  sharesFrom: month.optional(),
  /**
   * The local part of their company address (the domain is fixed by the
   * deployment). Required by the create API — see `employeeCreateWithAccessSchema`.
   */
  businessEmailLocal: z
    .string()
    .trim()
    .toLowerCase()
    .regex(MAIL_LOCAL_PART, "letters, digits, dots and dashes only")
    .optional(),
  /** Email the set-password link to the personal address right away. */
  sendInvite: z.boolean().optional(),
});
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;

/** What the "New employee" form posts: the address is not optional there. */
export const employeeCreateWithAccessSchema = employeeCreateSchema.required({
  businessEmailLocal: true,
});

export const employeeUpdateSchema = employeeCreateSchema
  .omit({
    shares: true,
    sharesFrom: true,
    businessEmailLocal: true,
    sendInvite: true,
  })
  .partial();
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

/**
 * A new shareholding, effective from a month.
 *
 * Appending rather than editing is what keeps a past payroll month honest — see
 * the model. The month is required so it is always explicit which payroll the
 * change first affects. Zero is allowed: it is how a director who has sold
 * out is taken off the split without touching the months before.
 */
export const shareholdingSchema = z.object({
  shares: z.number().int().min(0).max(1_000_000),
  effectiveFrom: month,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type ShareholdingInput = z.infer<typeof shareholdingSchema>;

/** The pool every holding is a fraction of. */
export const sharePoolSchema = z.object({
  totalShares: z.number().int().min(1).max(100_000_000),
  /** What one share was bought for, in poisha. Display only. */
  faceValueMinor: z.number().int().min(0).nullish(),
});
export type SharePoolInput = z.infer<typeof sharePoolSchema>;

export const payrollReopenSchema = z.object({
  reason: z.string().trim().min(1, "is required").max(500),
});

/**
 * A pay schedule: when a group of people is paid. Built from bare fields for
 * the update — Zod 4's `.partial()` would still fill the defaults and reset
 * fields the request never mentioned.
 */
const scheduleName = z.string().trim().min(1, "is required").max(80);
const scheduleDescription = z
  .string()
  .trim()
  .max(300)
  .optional()
  .or(z.literal(""));
const paydayOffset = z.number().int().min(0).max(31);

export const payScheduleCreateSchema = z.object({
  name: scheduleName,
  description: scheduleDescription,
  change: cycleChangeSchema,
  /** Payday is this many days after a period's last day; 0 is the next day. */
  paydayOffsetDays: paydayOffset.default(0),
  isDefault: z.boolean().optional(),
  /** People to move onto it. */
  employeeIds: z.array(objectId).max(500).optional(),
});
export type PayScheduleCreateInput = z.infer<typeof payScheduleCreateSchema>;

export const payScheduleUpdateSchema = z.object({
  name: scheduleName.optional(),
  description: scheduleDescription,
  paydayOffsetDays: paydayOffset.optional(),
  /** Only ever set true here: the old default steps down by itself. */
  isDefault: z.literal(true).optional(),
  /** A new cycle from a day; periods before it are left as they were. */
  change: cycleChangeSchema.optional(),
  employeeIds: z.array(objectId).max(500).optional(),
});
export type PayScheduleUpdateInput = z.infer<typeof payScheduleUpdateSchema>;

export const payoutMethodEnum = z.enum([
  "bank",
  "cash",
  "cheque",
  "mobile",
  "other",
]);
export type PayoutMethod = z.infer<typeof payoutMethodEnum>;

/**
 * Pay one or more people for a period of a schedule. What is paid is worked
 * out again on the server — the client never sends an amount.
 */
export const payoutCreateSchema = z.object({
  schedule: z.string().trim().min(1).max(40),
  periodKey: z.string().trim().min(1).max(40),
  employeeIds: z.array(objectId).min(1, "pick someone to pay").max(200),
  method: payoutMethodEnum,
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  /** The day the money went; today when absent. */
  paidOn: day.optional(),
});
export type PayoutCreateInput = z.infer<typeof payoutCreateSchema>;

export const payoutVoidSchema = z.object({
  reason: z.string().trim().min(1, "give a reason").max(500),
});

/**
 * The last day of salary already paid — for someone who was paid outside the
 * system before they were put on it. Never moved back past a payout.
 */
export const salaryPaidThroughSchema = z.object({ through: day });

/** A signature image from the forms: a PNG data URL, drawn or uploaded. */
export const signatureImageSchema = z.object({
  image: z
    .string()
    .max(4_000_000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "must be a PNG image"),
  source: z.enum(["upload", "draw"]).default("upload"),
});
export type SignatureImageInput = z.infer<typeof signatureImageSchema>;

/**
 * An email signature from the employee page: the composer's HTML (sanitised
 * again by the service) and whether the company logo goes above it. The
 * length cap is checked on the sanitised text, not here — pasted markup can
 * be long and still clean down to a short signature.
 */
export const emailSignatureSchema = z.object({
  html: z.string().max(100_000),
  logo: z.boolean(),
});
export type EmailSignatureInput = z.infer<typeof emailSignatureSchema>;
