import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
} from "@/lib/hr/expense-constants";
import {
  MAX_EXPENSE_LINES,
  MAX_EXPENSE_RECEIPTS,
} from "@/lib/hr/expense-lines";

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

/** One cost on a bill. */
export const expenseLineSchema = z.object({
  spentAt: dateOnly,
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().max(300).optional(),
  /** Whole poisha, like every other money field in the app. */
  amountMinor: z.number().int().min(1, "must be more than zero"),
});

/**
 * A claim is a bill: what it was for, and its lines. The total is worked out
 * by the service from the lines — never taken from the client.
 */
export const expenseCreateSchema = z.object({
  visitId: objectId.optional().nullable(),
  employeeId: objectId,
  description: z.string().trim().min(1, "is required").max(300),
  lines: z
    .array(expenseLineSchema)
    .min(1, "add at least one line")
    .max(MAX_EXPENSE_LINES, `at most ${MAX_EXPENSE_LINES} lines`),
  receiptDocumentIds: z
    .array(objectId)
    .max(MAX_EXPENSE_RECEIPTS, `at most ${MAX_EXPENSE_RECEIPTS} receipts`)
    .optional(),
});

/**
 * Editing is only allowed while a claim is still `submitted`, so the money
 * fields are safe to accept here — the service enforces the status rule.
 * Lines, when sent, replace the bill's lines as a whole.
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
export type ExpenseLineInput = z.infer<typeof expenseLineSchema>;
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
export type ExpenseApproveInput = z.infer<typeof expenseApproveSchema>;
export type ExpenseRejectInput = z.infer<typeof expenseRejectSchema>;
export type ExpenseReimburseInput = z.infer<typeof expenseReimburseSchema>;
