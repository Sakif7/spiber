/**
 * Expense vocabulary, free of any database import.
 *
 * The client forms need these lists, and importing them from the Mongoose
 * model pulled the driver into the browser bundle — which fails to build on
 * `async_hooks` and `dns`. Keeping them here means a form can render the
 * choices without the schema coming with it.
 */
export const EXPENSE_CATEGORIES = [
  "meal",
  "fuel",
  "vehicle",
  "transport",
  "accommodation",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_STATUSES = [
  "submitted",
  "approved",
  "rejected",
  "reimbursed",
] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export type ExpenseSettlement = "payroll" | "direct";

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  meal: "Meal",
  fuel: "Fuel",
  vehicle: "Vehicle",
  transport: "Transport",
  accommodation: "Accommodation",
  other: "Other",
};
