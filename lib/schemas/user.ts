import { z } from "zod";
import { addressSchema } from "@/lib/schemas/order";

export const ROLES = [
  "customer",
  "student",
  "instructor",
  "seller",
  /** A person on the payroll: the employee portal + their own mailbox. */
  "employee",
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
const localeField = z.enum(["en", "bn", "ja"]).optional();

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

export const resendVerificationSchema = z.object({
  email,
  locale: localeField,
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Editable profile fields; `defaultAddress: null` clears the saved address. */
export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional(),
  defaultAddress: addressSchema.nullable().optional(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

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

export const registerFormSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(200),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type RegisterFormValues = z.infer<typeof registerFormSchema>;

/**
 * Admin sidebar preferences (favourites + recents), self-only PATCH. Either
 * replace the favourites list, record one visit, or both. Ids are validated
 * against the nav registry server-side.
 */
export const salesSheetLayoutSchema = z.object({
  columns: z.array(z.string().trim().min(1).max(32)).max(32),
  groupBy: z.enum(["invoice", "client", "none"]),
  clientSubtotals: z.boolean(),
});

export const adminPrefsUpdateSchema = z
  .object({
    favourites: z.array(z.string().trim().min(1).max(64)).max(24).optional(),
    recent: z.string().trim().min(1).max(64).optional(),
    salesSheet: salesSheetLayoutSchema.optional(),
  })
  .refine(
    (d) =>
      d.favourites !== undefined ||
      d.recent !== undefined ||
      d.salesSheet !== undefined,
    { message: "Nothing to update" },
  );
export type AdminPrefsUpdateInput = z.infer<typeof adminPrefsUpdateSchema>;
