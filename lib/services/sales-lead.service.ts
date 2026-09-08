import { salesLeadNumber } from "@/lib/ids";
import { SalesLead, type ISalesLead } from "@/lib/models/salesLead";
import { connectToDatabase } from "@/lib/db/connect";
import type { Lean } from "@/lib/models/_shared";
import {
  SALES_LEAD_TRANSITIONS,
  statusesBelow,
  type SalesLeadStatus,
  type SalesLeadCreateInput,
  type SalesLeadUpdateInput,
} from "@/lib/schemas/sales-lead";
import {
  createSalesLead,
  getSalesLeadById,
  updateSalesLead,
  addLeadActivity,
  leadCodeTaken,
} from "@/lib/repositories/sales.repo";

/** Leads: the organisations the sales team sells to offline. */

export type Actor = { sub: string; email: string };

export type LeadError = "not_found" | "code_taken" | "invalid_transition";
export type LeadResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: LeadError };

const fail = (code: LeadError): LeadResult<never> => ({ ok: false, code });
const done = <T>(data: T): LeadResult<T> => ({ ok: true, data });

const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);

export async function createLead(
  input: SalesLeadCreateInput,
  actor: Actor,
): Promise<LeadResult<Lean<ISalesLead>>> {
  const code = input.code.toUpperCase();
  if (await leadCodeTaken(code)) return fail("code_taken");

  try {
    const doc = await createSalesLead({
      leadNumber: salesLeadNumber(),
      organisation: input.organisation,
      code,
      contactName: input.contactName,
      phone: input.phone,
      email: clean(input.email),
      address: input.address,
      addresseeTitle: clean(input.addresseeTitle),
      addresseeDept: clean(input.addresseeDept),
      remark: clean(input.remark),
      status: input.status ?? "new",
      createdBy: actor.sub,
      lastActivityAt: new Date(),
    });
    return done(doc.toObject() as Lean<ISalesLead>);
  } catch (e) {
    // Lost a race on the unique code index.
    if ((e as { code?: number }).code === 11000) return fail("code_taken");
    throw e;
  }
}

export async function updateLead(
  id: string,
  input: SalesLeadUpdateInput,
): Promise<LeadResult<Lean<ISalesLead>>> {
  const lead = await getSalesLeadById(id);
  if (!lead) return fail("not_found");

  const patch: Partial<ISalesLead> = {};
  if (input.organisation !== undefined) patch.organisation = input.organisation;
  if (input.code !== undefined) {
    const code = input.code.toUpperCase();
    if (code !== lead.code && (await leadCodeTaken(code, id))) {
      return fail("code_taken");
    }
    patch.code = code;
  }
  if (input.contactName !== undefined) patch.contactName = input.contactName;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = clean(input.email);
  if (input.address !== undefined) patch.address = input.address;
  if (input.addresseeTitle !== undefined) {
    patch.addresseeTitle = clean(input.addresseeTitle);
  }
  if (input.addresseeDept !== undefined) {
    patch.addresseeDept = clean(input.addresseeDept);
  }
  if (input.remark !== undefined) patch.remark = clean(input.remark);

  const updated = await updateSalesLead(id, patch);
  return updated ? done(updated) : fail("not_found");
}

export async function transitionLead(
  id: string,
  to: SalesLeadStatus,
  actor: Actor,
  note?: string,
): Promise<LeadResult<Lean<ISalesLead>>> {
  const lead = await getSalesLeadById(id);
  if (!lead) return fail("not_found");
  if (!SALES_LEAD_TRANSITIONS[lead.status].includes(to)) {
    return fail("invalid_transition");
  }
  const updated = await updateSalesLead(id, { status: to });
  if (!updated) return fail("not_found");
  await addLeadActivity(id, {
    authorId: actor.sub,
    body: note?.trim() || `Status changed to ${to.replace(/_/g, " ")}`,
    from: lead.status,
    to,
  });
  return done(updated);
}

/**
 * Move a lead forward because one of its orders progressed.
 *
 * One-way by construction: the update only matches statuses that sit BELOW the
 * target, and never `won` or `lost`. So a second order in an early stage cannot
 * drag a won client backwards, and a manual decision is never overwritten.
 */
export async function advanceLead(
  leadId: string,
  target: SalesLeadStatus,
): Promise<void> {
  await connectToDatabase();
  const below = statusesBelow(target);
  if (below.length === 0) return;
  await SalesLead.updateOne(
    { _id: leadId, status: { $in: below }, deletedAt: null },
    { $set: { status: target, lastActivityAt: new Date() } },
  ).exec();
}
