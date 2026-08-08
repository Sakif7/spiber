import mongoose, { Schema, type Model } from "mongoose";
import { ROLES, type Role } from "@/lib/schemas/user";
import type { Address } from "@/lib/schemas/order";

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
    tokenVersion: { type: Number, default: 0 },
    disabled: { type: Boolean, default: false },
  },
  { collection: "users", timestamps: true },
);

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ??
  mongoose.model<IUser>("User", userSchema);
