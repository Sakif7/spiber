import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
} from "@/lib/hr/expense-constants";

/**
 * A claim is a bill: one or more lines, each a cost on its own day — the
 * way a conveyance or TA bill is written. The claim's `amountMinor` is the
 * total of its lines and is what payroll, the dashboard and every sum read,
 * so the money paths never have to look inside a bill.
 *
 * Claims recorded before bills had lines carry one category, amount and day
 * on the claim itself and no `lines` at all. Everything that shows or counts
 * lines goes through `expenseLinesOf()`, which hands such a claim back as a
 * one-line bill — nothing is migrated, and nothing reads the old `category`
 * or `receiptDocumentId` directly.
 *
 * Free of any database import: the forms and pages share it.
 */

export const MAX_EXPENSE_LINES = 50;
export const MAX_EXPENSE_RECEIPTS = 10;

export type ExpenseLine = {
  spentAt: Date | string;
  category: ExpenseCategory;
  /** What the line was, when its category alone does not say. */
  description?: string | null;
  amountMinor: number;
};

/** The fields of a claim these helpers read — a lean row or a serialised one. */
export type ClaimLike = {
  lines?: ExpenseLine[] | null;
  category?: ExpenseCategory | null;
  amountMinor: number;
  spentAt: Date | string;
  receiptDocumentIds?: unknown[] | null;
  receiptDocumentId?: unknown;
};

export function expenseLinesOf(claim: ClaimLike): ExpenseLine[] {
  if (claim.lines?.length) return claim.lines;
  return [
    {
      spentAt: claim.spentAt,
      // A claim without lines always had a category: it was required.
      category: claim.category ?? EXPENSE_CATEGORIES[0],
      description: null,
      amountMinor: claim.amountMinor,
    },
  ];
}

/** Several receipts on a bill; at most one on a claim from before. */
export function expenseReceiptIdsOf(claim: ClaimLike): string[] {
  if (claim.receiptDocumentIds?.length) {
    return claim.receiptDocumentIds.map(String);
  }
  return claim.receiptDocumentId ? [String(claim.receiptDocumentId)] : [];
}

/** Each category on the bill once, in the order its lines use them. */
export function expenseCategoriesOf(claim: ClaimLike): ExpenseCategory[] {
  return [...new Set(expenseLinesOf(claim).map((l) => l.category))];
}

/** "Meal, Fuel". */
export function expenseCategoryLabel(claim: ClaimLike): string {
  return expenseCategoriesOf(claim)
    .map((c) => EXPENSE_CATEGORY_LABEL[c] ?? c)
    .join(", ");
}

/** The calendar day in Dhaka, which is the day every claim is recorded in. */
const dhakaDay = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

/**
 * A stored claim's lines as the bill form edits them. Days are read back in
 * Dhaka time: claims are stored at Dhaka midnight, so reading them in UTC
 * lands on the day before and saving would walk every date backwards.
 */
export function expenseFormLines(claim: ClaimLike): {
  key: string;
  spentAt: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
}[] {
  return expenseLinesOf(claim).map((l, i) => ({
    key: String(i),
    spentAt: dhakaDay(l.spentAt),
    category: l.category,
    description: l.description ?? "",
    amount: (l.amountMinor / 100).toString(),
  }));
}

/**
 * The first and last day on the bill, formatted by the caller: one day
 * when every line is from the same day, otherwise "from – to".
 */
export function expenseSpanLabel(
  claim: ClaimLike,
  format: (d: Date) => string,
): string {
  const days = expenseLinesOf(claim).map((l) => new Date(l.spentAt));
  const first = days.reduce((a, b) => (b < a ? b : a));
  const last = days.reduce((a, b) => (b > a ? b : a));
  return dhakaDay(first) === dhakaDay(last)
    ? format(first)
    : `${format(first)} – ${format(last)}`;
}
