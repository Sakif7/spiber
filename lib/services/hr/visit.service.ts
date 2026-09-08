import { connectToDatabase } from "@/lib/db/connect";
import { Visit, type IVisit } from "@/lib/models/visit";
import { Expense } from "@/lib/models/expense";
import type { Lean } from "@/lib/models/_shared";
import { visitRef } from "@/lib/ids";
import type { VisitCreateInput, VisitUpdateInput } from "@/lib/schemas/expense";

/** A day string from a date input, read at the Dhaka day boundary. */
function dhakaDay(value: string): Date {
  return new Date(`${value}T00:00:00+06:00`);
}

export type Actor = { sub: string; email: string };

export type VisitError = "not_found" | "has_expenses";
export type VisitResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: VisitError };

export async function createVisit(
  input: VisitCreateInput,
  actor: Actor,
): Promise<Lean<IVisit>> {
  await connectToDatabase();
  const doc = await Visit.create({
    ref: visitRef(),
    visitedAt: dhakaDay(input.visitedAt),
    purpose: input.purpose,
    organisation: input.organisation || null,
    location: input.location || null,
    attendees: input.attendees,
    leadId: input.leadId || null,
    outcome: input.outcome || null,
    notes: input.notes || null,
    createdBy: actor.sub,
  });
  return doc.toObject() as Lean<IVisit>;
}

export async function updateVisit(
  id: string,
  input: VisitUpdateInput,
): Promise<VisitResult<Lean<IVisit>>> {
  await connectToDatabase();
  const set: Record<string, unknown> = {};
  if (input.visitedAt !== undefined) set.visitedAt = dhakaDay(input.visitedAt);
  if (input.purpose !== undefined) set.purpose = input.purpose;
  if (input.organisation !== undefined)
    set.organisation = input.organisation || null;
  if (input.location !== undefined) set.location = input.location || null;
  if (input.attendees !== undefined) set.attendees = input.attendees;
  if (input.leadId !== undefined) set.leadId = input.leadId || null;
  if (input.outcome !== undefined) set.outcome = input.outcome || null;
  if (input.notes !== undefined) set.notes = input.notes || null;

  const doc = await Visit.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: set },
    { returnDocument: "after" },
  )
    .lean<Lean<IVisit>>()
    .exec();
  return doc ? { ok: true, data: doc } : { ok: false, code: "not_found" };
}

/**
 * Soft-delete a visit.
 *
 * Refused while any live claim still hangs off it: an expense whose visit has
 * vanished loses the context that justifies it, and the money record must
 * outlive the convenience of tidying up.
 */
export async function deleteVisit(id: string): Promise<VisitResult<true>> {
  await connectToDatabase();
  const claims = await Expense.countDocuments({
    visitId: id,
    deletedAt: null,
  }).exec();
  if (claims > 0) return { ok: false, code: "has_expenses" };

  const doc = await Visit.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  ).exec();
  return doc ? { ok: true, data: true } : { ok: false, code: "not_found" };
}
