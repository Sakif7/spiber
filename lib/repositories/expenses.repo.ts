import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Visit, type IVisit } from "@/lib/models/visit";
import { Expense, type IExpense } from "@/lib/models/expense";
import { Employee } from "@/lib/models/employee";
import type { Lean } from "@/lib/models/_shared";
import {
  sortSpec,
  applyDateRange,
  paginate,
  type Paged,
  type RepoListQuery,
} from "@/lib/repositories/list-query";
import { applyPartialSearch } from "@/lib/repositories/search-filter";

// ────────────────────────────── visits ──────────────────────────────

const VISIT_SORT: Record<string, string> = {
  date: "visitedAt",
  purpose: "purpose",
  organisation: "organisation",
  created: "createdAt",
};

export type VisitListParams = RepoListQuery & { attendee?: string };

export async function listVisits(
  params: VisitListParams = {},
): Promise<Paged<IVisit>> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { deletedAt: null };
  if (params.attendee && mongoose.isValidObjectId(params.attendee)) {
    filter.attendees = new mongoose.Types.ObjectId(params.attendee);
  }
  applyPartialSearch(filter, params.search, [
    "ref",
    "purpose",
    "organisation",
    "location",
  ]);
  applyDateRange(filter, params.from, params.to, "visitedAt");
  return paginate<IVisit>(Visit, filter, {
    sort: sortSpec(params.sort, params.dir, VISIT_SORT, {
      key: "date",
      dir: "desc",
    }),
    page: params.page,
    pageSize: params.pageSize,
  });
}

export async function getVisitById(id: string): Promise<Lean<IVisit> | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Visit.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IVisit>>()
    .exec();
}

// ───────────────────────────── expenses ─────────────────────────────

const EXPENSE_SORT: Record<string, string> = {
  date: "spentAt",
  amount: "amountMinor",
  status: "status",
  category: "category",
  created: "createdAt",
};

export type ExpenseListParams = RepoListQuery & {
  status?: string;
  category?: string;
  employee?: string;
  visitId?: string;
  settlement?: string;
};

export async function listExpenses(
  params: ExpenseListParams = {},
): Promise<Paged<IExpense>> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { deletedAt: null };
  if (params.status && params.status !== "all") filter.status = params.status;
  if (params.category && params.category !== "all") {
    filter.category = params.category;
  }
  if (params.settlement && params.settlement !== "all") {
    filter.settlement = params.settlement;
  }
  if (params.employee && mongoose.isValidObjectId(params.employee)) {
    filter.employeeId = new mongoose.Types.ObjectId(params.employee);
  }
  if (params.visitId && mongoose.isValidObjectId(params.visitId)) {
    filter.visitId = new mongoose.Types.ObjectId(params.visitId);
  }
  applyPartialSearch(filter, params.search, ["ref", "description"]);
  applyDateRange(filter, params.from, params.to, "spentAt");
  return paginate<IExpense>(Expense, filter, {
    sort: sortSpec(params.sort, params.dir, EXPENSE_SORT, {
      key: "date",
      dir: "desc",
    }),
    page: params.page,
    pageSize: params.pageSize,
  });
}

export async function getExpenseById(
  id: string,
): Promise<Lean<IExpense> | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Expense.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IExpense>>()
    .exec();
}

/** Claims recorded against one visit. */
export async function expensesForVisit(
  visitId: string,
): Promise<Lean<IExpense>[]> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(visitId)) return [];
  return Expense.find({ visitId, deletedAt: null })
    .sort({ spentAt: -1 })
    .lean<Lean<IExpense>[]>()
    .exec();
}

/** Name and code for every employee referenced by a page, in one query. */
export async function employeeNames(
  ids: string[],
): Promise<Map<string, { code: string; name: string }>> {
  await connectToDatabase();
  const valid = [...new Set(ids)].filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return new Map();
  const rows = await Employee.find({ _id: { $in: valid } })
    .select({ code: 1, name: 1 })
    .lean<{ _id: unknown; code: string; name: string }[]>()
    .exec();
  return new Map(
    rows.map((r) => [String(r._id), { code: r.code, name: r.name }]),
  );
}

/** Everyone who can have a claim recorded against them. */
export async function activeEmployeeOptions(): Promise<
  { id: string; code: string; name: string; designation: string }[]
> {
  await connectToDatabase();
  const rows = await Employee.find({ deletedAt: null, status: "active" })
    .select({ code: 1, name: 1, designation: 1 })
    .sort({ name: 1 })
    .lean<{ _id: unknown; code: string; name: string; designation: string }[]>()
    .exec();
  return rows.map((r) => ({
    id: String(r._id),
    code: r.code,
    name: r.name,
    designation: r.designation,
  }));
}

/** Headline figures for the expenses board. */
export async function expenseTotals(): Promise<{
  submitted: { count: number; amountMinor: number };
  awaitingPayroll: { count: number; amountMinor: number };
  awaitingDirect: { count: number; amountMinor: number };
}> {
  await connectToDatabase();
  const rows = await Expense.aggregate<{
    _id: { status: string; settlement: string | null };
    count: number;
    amountMinor: number;
  }>([
    { $match: { deletedAt: null, status: { $in: ["submitted", "approved"] } } },
    {
      $group: {
        _id: { status: "$status", settlement: "$settlement" },
        count: { $sum: 1 },
        amountMinor: { $sum: "$amountMinor" },
      },
    },
  ]).exec();

  const zero = { count: 0, amountMinor: 0 };
  const pick = (status: string, settlement?: string) =>
    rows
      .filter(
        (r) =>
          r._id.status === status &&
          (settlement === undefined || r._id.settlement === settlement),
      )
      .reduce(
        (acc, r) => ({
          count: acc.count + r.count,
          amountMinor: acc.amountMinor + r.amountMinor,
        }),
        { ...zero },
      );

  return {
    submitted: pick("submitted"),
    awaitingPayroll: pick("approved", "payroll"),
    awaitingDirect: pick("approved", "direct"),
  };
}
