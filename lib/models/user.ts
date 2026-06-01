import mongoose, { Schema, type Model } from "mongoose";
import { ROLES, type Role } from "@/lib/schemas/user";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  roles: Role[];
  emailVerified: boolean;
  locale: "en" | "bn";
  createdAt: Date;
  updatedAt: Date;
}

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
    locale: { type: String, enum: ["en", "bn"], default: "en" },
  },
  { collection: "users", timestamps: true },
);

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ??
  mongoose.model<IUser>("User", userSchema);
