import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { employeeCode } from "@/lib/ids";
import {
  Employee,
  EmployeeShareRate,
  type IEmployee,
  type IEmployeeShareRate,
} from "@/lib/models/employee";
import type { Lean } from "@/lib/models/_shared";
import type {
  EmployeeCreateInput,
  EmployeeUpdateInput,
  ShareRateInput,
} from "@/lib/schemas/hr";
import { monthOf, type PayrollMonth } from "@/lib/hr/months";

/** Employee records and the history of their revenue shares. */

export type Actor = { sub: string; email: string };

export type HrError = "not_found" | "duplicate_user";
export type HrResult<T> = { ok: true; data: T } | { ok: false; code: HrError };

const fail = (code: HrError): HrResult<never> => ({ ok: false, code });
const done = <T>(data: T): HrResult<T> => ({ ok: true, data });
const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);

export async function listEmployees(
  opts: { includeInactive?: boolean } = {},
): Promise<Lean<IEmployee>[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (!opts.includeInactive) q.status = "active";
  return Employee.find(q).sort({ name: 1 }).lean<Lean<IEmployee>[]>().exec();
}

export async function getEmployee(id: string): Promise<Lean<IEmployee> | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Employee.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IEmployee>>()
    .exec();
}

export async function createEmployee(
  input: EmployeeCreateInput,
  actor: Actor,
): Promise<HrResult<Lean<IEmployee>>> {
  await connectToDatabase();
  try {
    const doc = await Employee.create({
      code: employeeCode(),
      name: input.name,
      designation: input.designation,
      kind: input.kind,
      payScheme: input.payScheme,
      email: clean(input.email),
      phone: clean(input.phone),
      userId: input.userId ?? null,
      joinedAt: new Date(input.joinedAt),
      leftAt: input.leftAt ? new Date(input.leftAt) : null,
      status: input.status,
      fixedMonthlyMinor: input.fixedMonthlyMinor ?? null,
      bankDetails: input.bankDetails ?? null,
      notes: clean(input.notes),
    });

    // An opening share can be set while creating the record; it is stored as
    // the first entry in the rate history like any other.
    if (typeof input.rateBp === "number") {
      await EmployeeShareRate.create({
        employeeId: doc._id,
        rateBp: input.rateBp,
        effectiveFrom: input.rateFrom ?? monthOf(new Date(input.joinedAt)),
        createdBy: actor.sub,
        note: "Opening rate",
      });
    }
    return done(doc.toObject() as Lean<IEmployee>);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return fail("duplicate_user");
    throw e;
  }
}

export async function updateEmployee(
  id: string,
  input: EmployeeUpdateInput,
): Promise<HrResult<Lean<IEmployee>>> {
  await connectToDatabase();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.designation !== undefined) patch.designation = input.designation;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.payScheme !== undefined) patch.payScheme = input.payScheme;
  if (input.email !== undefined) patch.email = clean(input.email);
  if (input.phone !== undefined) patch.phone = clean(input.phone);
  if (input.userId !== undefined) patch.userId = input.userId ?? null;
  if (input.joinedAt !== undefined) patch.joinedAt = new Date(input.joinedAt);
  if (input.leftAt !== undefined) {
    patch.leftAt = input.leftAt ? new Date(input.leftAt) : null;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.fixedMonthlyMinor !== undefined) {
    patch.fixedMonthlyMinor = input.fixedMonthlyMinor ?? null;
  }
  if (input.bankDetails !== undefined) patch.bankDetails = input.bankDetails;
  if (input.notes !== undefined) patch.notes = clean(input.notes);

  const doc = await Employee.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: patch },
    { returnDocument: "after" },
  )
    .lean<Lean<IEmployee>>()
    .exec();
  return doc ? done(doc) : fail("not_found");
}

export async function softDeleteEmployee(id: string): Promise<boolean> {
  await connectToDatabase();
  const res = await Employee.updateOne(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date(), status: "inactive" } },
  ).exec();
  return res.matchedCount > 0;
}

// ───────────────────────────── share rates ─────────────────────────────

export async function listRates(
  employeeId: string,
): Promise<Lean<IEmployeeShareRate>[]> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(employeeId)) return [];
  return EmployeeShareRate.find({ employeeId })
    .sort({ effectiveFrom: -1, createdAt: -1 })
    .lean<Lean<IEmployeeShareRate>[]>()
    .exec();
}

export async function addRate(
  employeeId: string,
  input: ShareRateInput,
  actor: Actor,
): Promise<HrResult<Lean<IEmployeeShareRate>>> {
  await connectToDatabase();
  const employee = await getEmployee(employeeId);
  if (!employee) return fail("not_found");
  const doc = await EmployeeShareRate.create({
    employeeId,
    rateBp: input.rateBp,
    effectiveFrom: input.effectiveFrom,
    createdBy: actor.sub,
    note: clean(input.note),
  });
  return done(doc.toObject() as Lean<IEmployeeShareRate>);
}

/**
 * The rate in force for `month`: the newest record effective at or before it.
 *
 * String comparison is exact for "YYYY-MM", so the query needs no date maths —
 * and a rate added later with an earlier effective month still applies, which
 * is what makes a backdated correction possible.
 */
export async function rateForMonth(
  employeeId: string,
  month: PayrollMonth,
): Promise<number | null> {
  await connectToDatabase();
  const doc = await EmployeeShareRate.findOne({
    employeeId,
    effectiveFrom: { $lte: month },
  })
    .sort({ effectiveFrom: -1, createdAt: -1 })
    .lean<{ rateBp: number }>()
    .exec();
  return doc?.rateBp ?? null;
}
