import { z } from "zod";
import { isDistrictId } from "@/lib/bd/districts";

/**
 * Leads: the organisations the sales team sells to offline.
 *
 * The status is a relationship pipeline, and it advances on its own as the
 * lead's orders progress (a generated proposal moves it to "proposal sent", an
 * invoice to "won"). It only ever moves FORWARD automatically; an admin can
 * still set any allowed status by hand.
 */
export const salesLeadStatusEnum = z.enum([
  "new",
  "contacted",
  "proposal_sent",
  "negotiating",
  "won",
  "lost",
]);
export type SalesLeadStatus = z.infer<typeof salesLeadStatusEnum>;

export const SALES_LEAD_TRANSITIONS: Record<
  SalesLeadStatus,
  SalesLeadStatus[]
> = {
  new: ["contacted", "proposal_sent", "lost"],
  contacted: ["proposal_sent", "negotiating", "lost"],
  proposal_sent: ["negotiating", "won", "lost"],
  negotiating: ["won", "lost"],
  won: [],
  // A lost lead can come back; that is what "reopen" means here.
  lost: ["contacted", "negotiating"],
};

/**
 * How far through the pipeline each status is. Used to make the automatic
 * advance one-way: an order event never drags a lead backwards, and never
 * touches one that is already settled as won or lost.
 */
export const LEAD_RANK: Record<SalesLeadStatus, number> = {
  new: 0,
  contacted: 1,
  proposal_sent: 2,
  negotiating: 3,
  won: 4,
  lost: 4,
};

/** Statuses that an automatic advance to `target` is allowed to overwrite. */
export function statusesBelow(target: SalesLeadStatus): SalesLeadStatus[] {
  return salesLeadStatusEnum.options.filter(
    (s) => LEAD_RANK[s] < LEAD_RANK[target] && s !== "won" && s !== "lost",
  );
}

/**
 * What the lead is asking for.
 *
 * A hospital commonly wants more than one of these at once, so it is a set
 * rather than a single choice, and the free-text detail sits alongside it
 * rather than hiding behind an "Other" option — even "Equipment" is worth a
 * line saying which equipment.
 */
export const leadReasonEnum = z.enum(["software", "equipment", "consumable"]);
export type LeadReason = z.infer<typeof leadReasonEnum>;

export const LEAD_REASON_LABEL: Record<LeadReason, string> = {
  software: "Software",
  equipment: "Equipment",
  consumable: "Consumable",
};

const CODE_RE = /^[A-Z0-9]{2,8}$/;

export const salesLeadCreateSchema = z.object({
  organisation: z.string().trim().min(1, "is required").max(160),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CODE_RE, "2–8 letters or digits, e.g. EWMCH"),
  contactName: z.string().trim().min(1, "is required").max(120),
  phone: z.string().trim().min(1, "is required").max(40),
  email: z.email("must be a valid email").optional().or(z.literal("")),
  address: z.string().trim().min(1, "is required").max(400),
  /**
   * Region, chosen from the country's 64 districts.
   *
   * Kept apart from `address` on purpose: the address is one free-text line,
   * so "Chattogram 4203" and "Ctg." are the same place to a reader and nothing
   * at all to a filter. Stored as the district's slug.
   */
  area: z
    .string()
    .trim()
    .refine((v) => v === "" || isDistrictId(v), "pick a region")
    .optional(),
  /**
   * Who brought the lead in. Usually one of ours, but a referral from a
   * consultant or an existing client is just as real, so a typed name is
   * accepted where no employee fits.
   */
  sourceEmployeeId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "must be an id")
    .nullish()
    .or(z.literal("")),
  sourceName: z.string().trim().max(120).optional().or(z.literal("")),
  reasons: z.array(leadReasonEnum).max(3).optional(),
  reasonNote: z.string().trim().max(500).optional().or(z.literal("")),
  addresseeTitle: z.string().trim().max(120).optional().or(z.literal("")),
  addresseeDept: z.string().trim().max(160).optional().or(z.literal("")),
  remark: z.string().trim().max(2000).optional().or(z.literal("")),
  status: salesLeadStatusEnum.optional(),
});
export type SalesLeadCreateInput = z.infer<typeof salesLeadCreateSchema>;

export const salesLeadUpdateSchema = salesLeadCreateSchema.partial();
export type SalesLeadUpdateInput = z.infer<typeof salesLeadUpdateSchema>;

export const salesLeadTransitionSchema = z.object({
  to: salesLeadStatusEnum,
  note: z.string().trim().max(2000).optional(),
});

export const salesLeadNoteSchema = z.object({
  body: z.string().trim().min(1, "is required").max(2000),
});

export const salesLeadAssignSchema = z.object({
  assignedTo: z.string().trim().nullable(),
});

/**
 * Suggest a client code from an organisation name: initials of the significant
 * words, e.g. "East West Medical College & Hospital" → "EWMCH". The admin can
 * always override it.
 */
export function suggestLeadCode(organisation: string): string {
  const skip = new Set(["and", "the", "of", "for", "&", "ltd", "limited"]);
  const initials = organisation
    .split(/[\s\-&]+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter((w) => w && !skip.has(w.toLowerCase()))
    .map((w) => w[0]!.toUpperCase())
    .join("");
  if (initials.length >= 2) return initials.slice(0, 8);
  // Too few words to make initials from — fall back to the name itself.
  return (
    organisation
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8) || "CLIENT"
  );
}
