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
  ShareholdingInput,
  SharePoolInput,
} from "@/lib/schemas/hr";
import { monthOf, type PayrollMonth } from "@/lib/hr/months";
import { getSetting, setSetting } from "@/lib/repositories/settings.repo";
import {
  EMPTY_POOL,
  SHARE_POOL_KEY,
  type SharePool,
} from "@/lib/hr/share-pool";

/** Employee records, their shareholdings, and the pool those are drawn from. */

export type Actor = { sub: string; email: string };

export type HrError =
  | "not_found"
  | "duplicate_user"
  /** The allocation would take more shares than the pool has left. */
  | "pool_exceeded"
  /** No pool has been set, so there is nothing to allocate from. */
  | "no_pool";
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
  input: EmployeeCreateInput & {
    /** Full company address, already validated + checked free by the caller. */
    businessEmail?: string | null;
  },
  actor: Actor,
): Promise<HrResult<Lean<IEmployee>>> {
  await connectToDatabase();
  // Check the pool BEFORE the person exists: a refusal after the insert would
  // leave a record behind while the form reports a failure.
  const opening =
    typeof input.shares === "number" && input.shares > 0
      ? {
          shares: input.shares,
          from: input.sharesFrom ?? monthOf(new Date(input.joinedAt)),
        }
      : null;
  if (opening) {
    const room = await roomInPool(null, opening.from);
    if (!room.ok) return room;
    if (opening.shares > room.data) return fail("pool_exceeded");
  }
  try {
    const doc = await Employee.create({
      code: employeeCode(),
      name: input.name,
      designation: input.designation,
      kind: input.kind,
      payScheme: input.payScheme,
      email: clean(input.email),
      businessEmail: clean(input.businessEmail),
      phone: clean(input.phone),
      userId: input.userId ?? null,
      joinedAt: new Date(input.joinedAt),
      leftAt: input.leftAt ? new Date(input.leftAt) : null,
      status: input.status,
      fixedMonthlyMinor: input.fixedMonthlyMinor ?? null,
      bankDetails: input.bankDetails ?? null,
      notes: clean(input.notes),
    });

    // The opening holding, already checked against the pool above, goes in
    // as the first entry in the history like any other.
    if (opening) {
      await EmployeeShareRate.create({
        employeeId: doc._id,
        shares: opening.shares,
        effectiveFrom: opening.from,
        createdBy: actor.sub,
        note: "Opening holding",
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

// ───────────────────────────── the share pool ─────────────────────────────

export async function getSharePool(): Promise<SharePool> {
  const stored = await getSetting<Partial<SharePool>>(SHARE_POOL_KEY).catch(
    () => null,
  );
  if (!stored || typeof stored.totalShares !== "number") return EMPTY_POOL;
  return {
    totalShares: stored.totalShares,
    faceValueMinor: stored.faceValueMinor ?? null,
  };
}

/**
 * Set the pool.
 *
 * Shrinking it below what directors already hold is refused: those holdings
 * would add up to more than the whole, and a month's split would pay out more
 * than the pool. Approved months are frozen and unaffected either way.
 */
export async function setSharePool(
  input: SharePoolInput,
): Promise<HrResult<SharePool>> {
  const held = await allocatedShares(monthOf(new Date()));
  if (input.totalShares < held) return fail("pool_exceeded");
  const pool: SharePool = {
    totalShares: input.totalShares,
    faceValueMinor: input.faceValueMinor ?? null,
  };
  await setSetting(SHARE_POOL_KEY, pool);
  return done(pool);
}

/**
 * Shares held by everyone as of `month` — the newest holding at or before
 * that month, per director, added up. Someone who has left or been removed
 * still counts while their holding says they hold something: selling out is
 * recorded as a holding of zero, not by deleting the person.
 */
export async function allocatedShares(
  month: PayrollMonth,
  except?: string,
): Promise<number> {
  await connectToDatabase();
  const rows = await EmployeeShareRate.find({ effectiveFrom: { $lte: month } })
    .sort({ effectiveFrom: -1, createdAt: -1 })
    .lean<{ employeeId: unknown; shares?: number | null }[]>()
    .exec();
  const seen = new Set<string>();
  let total = 0;
  for (const r of rows) {
    const id = String(r.employeeId);
    if (id === except || seen.has(id)) continue;
    seen.add(id);
    total += r.shares ?? 0;
  }
  return total;
}

/**
 * How many shares a new holding may take from `month`. `employeeId` is whose
 * current holding the new row replaces (and so is not counted); null for a
 * person who does not exist yet.
 */
async function roomInPool(
  employeeId: string | null,
  month: PayrollMonth,
): Promise<HrResult<number>> {
  const pool = await getSharePool();
  if (pool.totalShares <= 0) return fail("no_pool");
  const others = await allocatedShares(month, employeeId ?? undefined);
  return done(Math.max(0, pool.totalShares - others));
}

// ───────────────────────────── shareholdings ─────────────────────────────

export async function listHoldings(
  employeeId: string,
): Promise<Lean<IEmployeeShareRate>[]> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(employeeId)) return [];
  return EmployeeShareRate.find({ employeeId })
    .sort({ effectiveFrom: -1, createdAt: -1 })
    .lean<Lean<IEmployeeShareRate>[]>()
    .exec();
}

/**
 * Record a new holding from a month.
 *
 * Checked against the pool as of that month, less what everyone else holds
 * then — this director's own current holding is not counted, because the new
 * row replaces it rather than adding to it.
 */
export async function addHolding(
  employeeId: string,
  input: ShareholdingInput,
  actor: Actor,
): Promise<HrResult<Lean<IEmployeeShareRate>>> {
  await connectToDatabase();
  const employee = await getEmployee(employeeId);
  if (!employee) return fail("not_found");
  const room = await roomInPool(employeeId, input.effectiveFrom);
  if (!room.ok) return room;
  if (input.shares > room.data) return fail("pool_exceeded");
  const doc = await EmployeeShareRate.create({
    employeeId,
    shares: input.shares,
    effectiveFrom: input.effectiveFrom,
    createdBy: actor.sub,
    note: clean(input.note),
  });
  return done(doc.toObject() as Lean<IEmployeeShareRate>);
}

/**
 * The holding in force for `month`: the newest record effective at or before
 * it. Null when nothing has been recorded yet — that director is not on the
 * month's payroll at all, which is what "only from when they joined" means.
 *
 * String comparison is exact for "YYYY-MM", so the query needs no date maths —
 * and a holding added later with an earlier effective month still applies,
 * which is what makes a backdated correction possible.
 *
 * A legacy percentage row (no `shares`) comes back as `{ rateBp }` so a month
 * nobody has migrated still computes the way it was agreed.
 */
export async function holdingForMonth(
  employeeId: string,
  month: PayrollMonth,
): Promise<{ shares: number } | { rateBp: number } | null> {
  await connectToDatabase();
  const doc = await EmployeeShareRate.findOne({
    employeeId,
    effectiveFrom: { $lte: month },
  })
    .sort({ effectiveFrom: -1, createdAt: -1 })
    .lean<{ shares?: number | null; rateBp?: number | null }>()
    .exec();
  if (!doc) return null;
  if (typeof doc.shares === "number") return { shares: doc.shares };
  if (typeof doc.rateBp === "number") return { rateBp: doc.rateBp };
  return null;
}
