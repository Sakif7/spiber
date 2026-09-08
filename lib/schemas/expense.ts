import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
} from "@/lib/hr/expense-constants";

/**
 * Visits and the expenses claimed against them.
 *
 * Both are recorded by a super admin on the directors' behalf, so there is no
 * separate "submitted by me" shape — every write is an admin write.
 */

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "must be a valid id");

/** A calendar day, as the date input sends it. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date")
  .refine((v) => !Number.isNaN(Date.parse(v)), "must be a real date");

export const visitCreateSchema = z.object({
  visitedAt: dateOnly,
  purpose: z.string().trim().min(1, "is required").max(200),
  organisation: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  attendees: z.array(objectId).min(1, "pick at least one person").max(20),
  leadId: objectId.optional().nullable(),
  outcome: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const visitUpdateSchema = visitCreateSchema.partial();

export const expenseCreateSchema = z.object({
  visitId: objectId.optional().nullable(),
  employeeId: objectId,
  category: z.enum(EXPENSE_CATEGORIES),
  /** Whole poisha, like every other money field in the app. */
  amountMinor: z.number().int().min(1, "must be more than zero"),
  spentAt: dateOnly,
  description: z.string().trim().min(1, "is required").max(300),
  receiptDocumentId: objectId.optional().nullable(),
});

/**
 * Editing is only allowed while a claim is still `submitted`, so the money
 * fields are safe to accept here — the service enforces the status rule.
 */
export const expenseUpdateSchema = expenseCreateSchema.partial();

export const expenseApproveSchema = z.object({
  settlement: z.enum(["payroll", "direct"]),
  note: z.string().trim().max(500).optional(),
});

export const expenseRejectSchema = z.object({
  reason: z.string().trim().min(1, "give a reason").max(500),
});

export const expenseReimburseSchema = z.object({
  method: z.enum(["cash", "bank", "mobile", "other"]),
  reference: z.string().trim().max(120).optional(),
  paidAt: dateOnly.optional(),
});

export const expenseStatusFilter = z.enum(EXPENSE_STATUSES);

export type VisitCreateInput = z.infer<typeof visitCreateSchema>;
export type VisitUpdateInput = z.infer<typeof visitUpdateSchema>;
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
export type ExpenseApproveInput = z.infer<typeof expenseApproveSchema>;
export type ExpenseRejectInput = z.infer<typeof expenseRejectSchema>;
export type ExpenseReimburseInput = z.infer<typeof expenseReimburseSchema>;
