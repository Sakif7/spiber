import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { CycleKind } from "@/lib/hr/cycles";

/**
 * A pay schedule: when a group of people gets the money.
 *
 * Its cycle cuts time into pay periods (`lib/hr/cycles.ts`); when a period
 * ends, each person on the schedule is owed a payout of everything they have
 * earned and not yet been paid — shares from approved profit periods, their
 * salary by the day, and approved claims. How much a share is worth is the
 * profit cycle's business, never the schedule's: two directors on different
 * schedules split the same profit and are simply paid on different days.
 *
 * The cycle is kept as versions, each from a day, so changing it never re-cuts
 * a period someone has already been paid for. Exactly one schedule is the
 * default, and an employee with no schedule of their own is on it.
 */
export interface IPayScheduleVersion {
  from: string;
  cycle: {
    kind: CycleKind;
    every?: number | null;
    splitDay?: number | null;
  };
}

export interface IPaySchedule {
  name: string;
  description?: string | null;
  /** Oldest first. None means calendar months. */
  versions: IPayScheduleVersion[];
  /** Payday falls this many days after a period's last day (0 = the next day). */
  paydayOffsetDays: number;
  isDefault: boolean;
  archivedAt?: Date | null;
  createdBy?: Types.ObjectId | string | null;
  activity: {
    authorId?: Types.ObjectId | string | null;
    body: string;
    at: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const versionSchema = new Schema<IPayScheduleVersion>(
  {
    from: { type: String, required: true },
    cycle: {
      kind: {
        type: String,
        enum: ["months", "semi_monthly", "weeks", "days"],
        required: true,
      },
      every: { type: Number, default: null },
      splitDay: { type: Number, default: null },
    },
  },
  { _id: false },
);

const payScheduleSchema = new Schema<IPaySchedule>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    versions: { type: [versionSchema], default: [] },
    paydayOffsetDays: { type: Number, default: 0, min: 0, max: 31 },
    isDefault: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    activity: {
      type: [
        new Schema(
          {
            authorId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              default: null,
            },
            body: { type: String, required: true },
            at: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { collection: "pay_schedules", timestamps: true },
);

// One living default: it is what "no schedule of their own" means.
payScheduleSchema.index(
  { isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true, archivedAt: null },
  },
);
payScheduleSchema.index({ archivedAt: 1, name: 1 });

export const PaySchedule: Model<IPaySchedule> =
  (mongoose.models.PaySchedule as Model<IPaySchedule>) ??
  mongoose.model<IPaySchedule>("PaySchedule", payScheduleSchema);
