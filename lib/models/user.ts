import mongoose, { Schema, type Model } from "mongoose";
import { ROLES, type Role } from "@/lib/schemas/user";
import type { Address } from "@/lib/schemas/order";

/** Persisted admin navigation preferences (see `lib/admin/prefs.ts`). */
export interface IAdminPrefs {
  favourites: string[];
  recents: { id: string; at: Date }[];
  /** How this admin arranged the sales spreadsheet. Free-form on purpose:
      the columns it names are validated on read, not by the database. */
  salesSheet?: unknown;
}

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  roles: Role[];
  emailVerified: boolean;
  locale: "en" | "bn" | "ja";
  // Profile (optional): contact phone + default shipping address, used to
  // prefill checkout and quotation forms.
  phone?: string;
  defaultAddress?: Address | null;
  // Admin-only: pinned favourites + recent pages for the admin sidebar and
  // command palette. Absent for customers (and for admins who never pinned).
  adminPrefs?: IAdminPrefs | null;
  // Bumped on password reset / forced logout; embedded in refresh + reset tokens
  // and checked on use, so outstanding tokens can be revoked ("log out everywhere"
  // and single-use reset links).
  tokenVersion: number;
  // Hard account lock: a disabled user cannot refresh a session or pass admin guards.
  disabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const addressDef = new Schema(
  {
    label: { type: String, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const adminRecentDef = new Schema(
  {
    id: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const adminPrefsDef = new Schema<IAdminPrefs>(
  {
    favourites: { type: [String], default: [] },
    recents: { type: [adminRecentDef], default: [] },
    salesSheet: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    roles: { type: [String], enum: ROLES, default: ["customer"] },
    emailVerified: { type: Boolean, default: false },
    locale: { type: String, enum: ["en", "bn", "ja"], default: "en" },
    phone: { type: String, trim: true },
    defaultAddress: { type: addressDef, default: null },
    adminPrefs: { type: adminPrefsDef, default: null },
    tokenVersion: { type: Number, default: 0 },
    disabled: { type: Boolean, default: false },
  },
  { collection: "users", timestamps: true },
);

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ??
  mongoose.model<IUser>("User", userSchema);
