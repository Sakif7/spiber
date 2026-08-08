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
