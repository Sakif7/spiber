import { z } from "zod";

/** Employees and payroll. */

export const employeeKindEnum = z.enum(["director", "staff"]);
export const paySchemeEnum = z.enum(["revenue_share", "fixed", "none"]);
export type PayScheme = z.infer<typeof paySchemeEnum>;

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "must be an id");
const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "must be a month, e.g. 2026-08");

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
  /** Convenience: set the opening revenue share while creating the record. */
  rateBp: z.number().int().min(0).max(10000).optional(),
  rateFrom: month.optional(),
});
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;

export const employeeUpdateSchema = employeeCreateSchema
  .omit({ rateBp: true, rateFrom: true })
  .partial();
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

/**
 * A new revenue share, effective from a month.
 *
 * Appending rather than editing is what keeps a past payroll month honest — see
 * the model. The month is required so it is always explicit which payroll the
 * change first affects.
 */
export const shareRateSchema = z.object({
  rateBp: z.number().int().min(0).max(10000),
  effectiveFrom: month,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type ShareRateInput = z.infer<typeof shareRateSchema>;

export const payrollLinePaidSchema = z.object({
  paidAt: z.iso.datetime().optional(),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
});

export const payrollReopenSchema = z.object({
  reason: z.string().trim().min(1, "is required").max(500),
});
