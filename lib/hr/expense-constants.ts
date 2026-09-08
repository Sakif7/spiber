/**
 * Expense vocabulary, free of any database import.
 *
 * The client forms need these lists, and importing them from the Mongoose
 * model pulled the driver into the browser bundle — which fails to build on
 * `async_hooks` and `dns`. Keeping them here means a form can render the
 * choices without the schema coming with it.
 */
/**
 * What a claim can be for.
 *
 * "Vehicle" and "Transport" were both really fuel, so a director had to guess
 * which one to pick and the totals split across three headings that meant the
 * same thing. One heading now covers running a vehicle.
 */
export const EXPENSE_CATEGORIES = [
  "meal",
  "courier",
  "delivery",
  "fuel",
  "gift",
  "commissioning",
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
  courier: "Courier",
  delivery: "Delivery",
  fuel: "Fuel",
  gift: "Gift",
  commissioning: "Commissioning",
};
