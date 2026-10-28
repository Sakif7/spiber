import type { Types } from "mongoose";

/** Reusable Mongoose field definitions shared across models. */

export const localizedDef = {
  en: { type: String, required: true },
  bn: { type: String },
  ja: { type: String },
} as const;

/** Fully-optional localized field (e.g. an optional description) — same trio
 * of locales but nothing required, so an absent value stays valid. */
export const localizedOptionalDef = {
  en: { type: String },
  bn: { type: String },
  ja: { type: String },
} as const;

export interface LocalizedDoc {
  en: string;
  bn?: string;
  ja?: string;
}

/** A `.lean()` result of a model interface — adds the `_id` the schema omits. */
export type Lean<T> = T & { _id: Types.ObjectId };

/**
 * Money a tourism case or travel request collected online — the amount staff
 * chose to collect on its quote (owner, 2026-10-28), applied once by the
 * gateway's confirmation. Absent until paid; read it with `?.`.
 */
export interface ITourismPayment {
  status: "unpaid" | "paid";
  paidAt?: Date | null;
  /** What was taken, in poisha (whole taka). */
  amountMinor?: number | null;
  /** "online" — the only way tourism money is recorded. */
  method?: string | null;
  /** The gateway's transaction id. */
  reference?: string | null;
}

export const tourismPaymentDef = {
  status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
  paidAt: { type: Date, default: null },
  amountMinor: { type: Number, default: null, min: 0 },
  method: { type: String, default: null },
  reference: { type: String, default: null },
} as const;
