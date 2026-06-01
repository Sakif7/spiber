import { z } from "zod";

export const ROLES = [
  "customer",
  "student",
  "instructor",
  "admin",
  "super_admin",
] as const;

export const roleSchema = z.enum(ROLES);
export type Role = (typeof ROLES)[number];

const email = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email(),
);
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200);
const localeField = z.enum(["en", "bn"]).optional();

export const registerInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email,
  password,
  locale: localeField,
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const passwordResetRequestSchema = z.object({
  email,
  locale: localeField,
});
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password,
});
export type PasswordResetConfirmInput = z.infer<
  typeof passwordResetConfirmSchema
>;

/** Client form schemas (plain, no transforms) for react-hook-form. */
export const loginFormSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const resetFormSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type ResetFormValues = z.infer<typeof resetFormSchema>;
