import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { PaySchedule, type IPaySchedule } from "@/lib/models/paySchedule";
import { PayrollPayout } from "@/lib/models/payrollPayout";
import { Employee } from "@/lib/models/employee";
import type { Lean } from "@/lib/models/_shared";
import {
  addDays,
  canStartOn,
  cycleError,
  dayOf,
  describeCycle,
  MONTHLY,
  normalizeVersions,
  versionOn,
  withVersion,
  type Cycle,
  type CycleVersion,
  type DayKey,
  type Period,
} from "@/lib/hr/cycles";
import type {
  PayScheduleCreateInput,
  PayScheduleUpdateInput,
} from "@/lib/schemas/hr";

/**
 * Pay schedules: when each group of people gets paid.
 *
 * Exactly one schedule is the default, and anyone without a schedule of their
 * own is on it. Until the owner saves one, the default is a built-in Monthly
 * schedule that exists only in code (`virtual`); the first time anything has
 * to point at it — a payout, an edit — it is written down for real, so a
 * stored record never refers to something that is not there.
 */

export type Actor = { sub: string; email: string };

/** What a URL or a form says for "the default schedule", stored or not. */
export const DEFAULT_SCHEDULE_REF = "default";

export type ScheduleView = {
  /** The stored id; `DEFAULT_SCHEDULE_REF` while the default is built-in. */
  id: string;
  name: string;
  description: string | null;
  versions: CycleVersion[];
  paydayOffsetDays: number;
  isDefault: boolean;
  /** The built-in default nobody has saved yet. */
  virtual: boolean;
};

export type ScheduleError =
  | "not_found"
  | "bad_cycle"
  /** The new cycle would start inside a period someone was already paid for. */
  | "cycle_locked"
  | "is_default"
  | "has_people"
  | "bad_people";

export type ScheduleResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ScheduleError };

const fail = (code: ScheduleError): ScheduleResult<never> => ({
  ok: false,
  code,
});
const done = <T>(data: T): ScheduleResult<T> => ({ ok: true, data });
const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);

const BUILT_IN: ScheduleView = {
  id: DEFAULT_SCHEDULE_REF,
  name: "Monthly",
  description: null,
  versions: [],
  paydayOffsetDays: 0,
  isDefault: true,
  virtual: true,
};

function view(doc: Lean<IPaySchedule>): ScheduleView {
  return {
    id: String(doc._id),
    name: doc.name,
    description: doc.description ?? null,
    versions: normalizeVersions(doc.versions),
    paydayOffsetDays: doc.paydayOffsetDays ?? 0,
    isDefault: Boolean(doc.isDefault),
    virtual: false,
  };
}

/** The cycle a schedule runs on today, for a one-line description. */
export function currentCycle(schedule: ScheduleView, today: DayKey): Cycle {
  return versionOn(schedule.versions, today)?.cycle ?? MONTHLY;
}

export function describeSchedule(
  schedule: ScheduleView,
  today: DayKey,
): string {
  return describeCycle(currentCycle(schedule, today));
}

/** The day a period's payout falls due. */
export function paydayOf(schedule: ScheduleView, period: Period): DayKey {
  return addDays(period.end, schedule.paydayOffsetDays);
}

/** Every living schedule, the default first. */
export async function listSchedules(): Promise<ScheduleView[]> {
  await connectToDatabase();
  const docs = await PaySchedule.find({ archivedAt: null })
    .sort({ isDefault: -1, name: 1 })
    .lean<Lean<IPaySchedule>[]>()
    .exec();
  const views = docs.map(view);
  return views.some((s) => s.isDefault) ? views : [BUILT_IN, ...views];
}

/** A schedule by id, or the default for `DEFAULT_SCHEDULE_REF`. */
export async function resolveSchedule(
  ref: string,
): Promise<ScheduleView | null> {
  await connectToDatabase();
  if (ref === DEFAULT_SCHEDULE_REF) {
    const doc = await PaySchedule.findOne({ isDefault: true, archivedAt: null })
      .lean<Lean<IPaySchedule>>()
      .exec();
    return doc ? view(doc) : BUILT_IN;
  }
  if (!mongoose.isValidObjectId(ref)) return null;
  const doc = await PaySchedule.findOne({ _id: ref, archivedAt: null })
    .lean<Lean<IPaySchedule>>()
    .exec();
  return doc ? view(doc) : null;
}

/** Write the built-in default down, once, so records can point at it. */
export async function ensureDefaultSchedule(
  actor?: Actor,
): Promise<ScheduleView> {
  await connectToDatabase();
  const existing = await PaySchedule.findOne({
    isDefault: true,
    archivedAt: null,
  })
    .lean<Lean<IPaySchedule>>()
    .exec();
  if (existing) return view(existing);
  try {
    const doc = await PaySchedule.create({
      name: BUILT_IN.name,
      versions: [],
      paydayOffsetDays: 0,
      isDefault: true,
      createdBy: actor?.sub ?? null,
      activity: [
        {
          authorId: actor?.sub ?? null,
          body: "The built-in Monthly schedule, saved as the default",
          at: new Date(),
        },
      ],
    });
    return view(doc.toObject() as Lean<IPaySchedule>);
  } catch (e) {
    // Someone else saved it in the same instant: theirs is the default.
    if ((e as { code?: number }).code !== 11000) throw e;
    const doc = await PaySchedule.findOne({ isDefault: true, archivedAt: null })
      .lean<Lean<IPaySchedule>>()
      .exec();
    if (!doc) throw e;
    return view(doc);
  }
}

/** A stored schedule's id for a ref, saving the default first if need be. */
async function storedId(ref: string, actor: Actor): Promise<string | null> {
  if (ref === DEFAULT_SCHEDULE_REF) {
    return (await ensureDefaultSchedule(actor)).id;
  }
  const s = await resolveSchedule(ref);
  return s && !s.virtual ? s.id : null;
}

/** The schedule someone is paid on: their own, or the default. */
export async function scheduleForEmployee(e: {
  payScheduleId?: unknown;
}): Promise<ScheduleView> {
  if (e.payScheduleId) {
    const own = await resolveSchedule(String(e.payScheduleId));
    if (own) return own;
  }
  return (await resolveSchedule(DEFAULT_SCHEDULE_REF)) ?? BUILT_IN;
}

/** The query for the people a schedule pays. */
export function peopleOnSchedule(
  schedule: ScheduleView,
): Record<string, unknown> {
  const own = schedule.virtual
    ? []
    : [{ payScheduleId: new mongoose.Types.ObjectId(schedule.id) }];
  return {
    deletedAt: null,
    $or: schedule.isDefault ? [...own, { payScheduleId: null }] : own,
  };
}

/** How many people each schedule pays, by schedule id. */
export async function peopleCounts(
  schedules: ScheduleView[],
): Promise<Map<string, number>> {
  await connectToDatabase();
  const out = new Map<string, number>();
  await Promise.all(
    schedules.map(async (s) => {
      const query = peopleOnSchedule(s);
      const n = (query.$or as unknown[]).length
        ? await Employee.countDocuments({ ...query, status: "active" }).exec()
        : 0;
      out.set(s.id, n);
    }),
  );
  return out;
}

/**
 * The first day a schedule's new cycle may begin: the end of the latest
 * period anyone on it was paid for. A period that was paid is never re-cut.
 */
export async function scheduleFloor(
  scheduleId: string,
): Promise<DayKey | null> {
  if (!mongoose.isValidObjectId(scheduleId)) return null;
  await connectToDatabase();
  const last = await PayrollPayout.findOne({
    scheduleId,
    status: { $in: ["processing", "paid"] },
  })
    .sort({ periodEnd: -1 })
    .select({ periodEnd: 1 })
    .lean<{ periodEnd?: Date } | null>()
    .exec();
  return last?.periodEnd ? dayOf(new Date(last.periodEnd)) : null;
}

/** Move people onto a schedule. The default stores no id: it follows. */
async function assign(
  employeeIds: string[],
  schedule: { id: string; isDefault: boolean },
): Promise<boolean> {
  if (employeeIds.length === 0) return true;
  const found = await Employee.countDocuments({
    _id: { $in: employeeIds },
    deletedAt: null,
  }).exec();
  if (found !== new Set(employeeIds).size) return false;
  await Employee.updateMany(
    { _id: { $in: employeeIds }, deletedAt: null },
    {
      $set: {
        payScheduleId: schedule.isDefault
          ? null
          : new mongoose.Types.ObjectId(schedule.id),
      },
    },
  ).exec();
  return true;
}

/** Step the current default down so another can take its place. */
async function clearDefault(except?: string): Promise<void> {
  // People who simply followed the old default stay with it: they are given
  // its id, so making a new default never quietly moves anyone's payday.
  const old = await PaySchedule.findOne({ isDefault: true, archivedAt: null })
    .select({ _id: 1 })
    .lean<{ _id: unknown } | null>()
    .exec();
  if (old && String(old._id) !== except) {
    await Employee.updateMany(
      { deletedAt: null, payScheduleId: null },
      { $set: { payScheduleId: old._id } },
    ).exec();
    await PaySchedule.updateOne(
      { _id: old._id },
      { $set: { isDefault: false } },
    ).exec();
  }
}

export async function createSchedule(
  input: PayScheduleCreateInput,
  actor: Actor,
): Promise<ScheduleResult<ScheduleView>> {
  await connectToDatabase();
  if (cycleError(input.change.cycle)) return fail("bad_cycle");
  if (!canStartOn(input.change.cycle, input.change.from)) {
    return fail("bad_cycle");
  }
  if (input.employeeIds?.length) {
    const found = await Employee.countDocuments({
      _id: { $in: input.employeeIds },
      deletedAt: null,
    }).exec();
    if (found !== new Set(input.employeeIds).size) return fail("bad_people");
  }
  if (input.isDefault) {
    // The built-in default has people following it; save it first so they
    // stay on Monthly rather than jumping to the new schedule.
    await ensureDefaultSchedule(actor);
    await clearDefault();
  }
  const doc = await PaySchedule.create({
    name: input.name,
    description: clean(input.description),
    versions: [{ from: input.change.from, cycle: input.change.cycle }],
    paydayOffsetDays: input.paydayOffsetDays ?? 0,
    isDefault: Boolean(input.isDefault),
    createdBy: actor.sub,
    activity: [
      {
        authorId: actor.sub,
        body: `Created: ${describeCycle(input.change.cycle).toLowerCase()} from ${input.change.from}`,
        at: new Date(),
      },
    ],
  });
  const created = view(doc.toObject() as Lean<IPaySchedule>);
  await assign(input.employeeIds ?? [], created);
  return done(created);
}

export async function updateSchedule(
  ref: string,
  input: PayScheduleUpdateInput,
  actor: Actor,
): Promise<ScheduleResult<ScheduleView>> {
  await connectToDatabase();
  const id = await storedId(ref, actor);
  if (!id) return fail("not_found");
  const current = await resolveSchedule(id);
  if (!current) return fail("not_found");

  const set: Record<string, unknown> = {};
  const notes: string[] = [];
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) {
    set.description = clean(input.description);
  }
  if (input.paydayOffsetDays !== undefined) {
    set.paydayOffsetDays = input.paydayOffsetDays;
  }
  if (input.change) {
    if (
      cycleError(input.change.cycle) ||
      !canStartOn(input.change.cycle, input.change.from)
    ) {
      return fail("bad_cycle");
    }
    const floor = await scheduleFloor(id);
    if (floor && input.change.from < floor) return fail("cycle_locked");
    set.versions = withVersion(current.versions, input.change);
    notes.push(
      `Cycle: ${describeCycle(input.change.cycle).toLowerCase()} from ${input.change.from}`,
    );
  }
  if (input.employeeIds) {
    const found = await Employee.countDocuments({
      _id: { $in: input.employeeIds },
      deletedAt: null,
    }).exec();
    if (found !== new Set(input.employeeIds).size) return fail("bad_people");
  }
  if (input.isDefault && !current.isDefault) {
    await clearDefault(id);
    set.isDefault = true;
    notes.push("Made the default schedule");
  }

  const doc = await PaySchedule.findOneAndUpdate(
    { _id: id, archivedAt: null },
    {
      $set: set,
      ...(notes.length
        ? {
            $push: {
              activity: {
                $each: notes.map((body) => ({
                  authorId: actor.sub,
                  body,
                  at: new Date(),
                })),
              },
            },
          }
        : {}),
    },
    { returnDocument: "after" },
  )
    .lean<Lean<IPaySchedule>>()
    .exec();
  if (!doc) return fail("not_found");
  const updated = view(doc);
  if (input.employeeIds) await assign(input.employeeIds, updated);
  return done(updated);
}

/** Retire a schedule nobody is on. The default can only be replaced. */
export async function archiveSchedule(
  ref: string,
  actor: Actor,
): Promise<ScheduleResult<true>> {
  await connectToDatabase();
  const current = await resolveSchedule(ref);
  if (!current || current.virtual) return fail("not_found");
  if (current.isDefault) return fail("is_default");
  const people = await Employee.countDocuments({
    deletedAt: null,
    payScheduleId: new mongoose.Types.ObjectId(current.id),
  }).exec();
  if (people > 0) return fail("has_people");
  const res = await PaySchedule.updateOne(
    { _id: current.id, archivedAt: null, isDefault: false },
    {
      $set: { archivedAt: new Date() },
      $push: {
        activity: { authorId: actor.sub, body: "Archived", at: new Date() },
      },
    },
  ).exec();
  return res.modifiedCount === 1 ? done(true) : fail("not_found");
}
