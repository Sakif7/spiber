import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Appointment, type IAppointment } from "@/lib/models/appointment";
import type { Lean } from "@/lib/models/_shared";
import type {
  AppointmentStatus,
  AppointmentType,
} from "@/lib/schemas/appointment";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type Filter = NonNullable<Parameters<typeof Appointment.countDocuments>[0]>;

export async function createAppointment(data: Partial<IAppointment>) {
  await connectToDatabase();
  return Appointment.create(data);
}

export async function getAppointmentById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Appointment.findOne({ _id: id, deletedAt: null }).exec();
}

export async function getAppointmentByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Appointment.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IAppointment>>()
    .exec();
}

export async function getAppointmentByNumber(
  appointmentNumber: string,
  email: string,
) {
  await connectToDatabase();
  return Appointment.findOne({
    appointmentNumber,
    "patient.email": email.trim().toLowerCase(),
    deletedAt: null,
  })
    .lean<Lean<IAppointment>>()
    .exec();
}

/** Sort keys the admin list exposes → stored fields. */
const APPOINTMENT_SORT: Record<string, string> = {
  date: "createdAt",
  number: "appointmentNumber",
  patient: "patient.name",
  status: "status",
  type: "type",
};

export type AppointmentListParams = RepoListQuery & {
  status?: AppointmentStatus;
  type?: AppointmentType;
  assignedTo?: string;
};

export async function listAppointments(params: AppointmentListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.type) q.type = params.type;
  if (params.assignedTo && mongoose.isValidObjectId(params.assignedTo)) {
    q.assignedTo = params.assignedTo;
  }
  applyPartialSearch(q, params.search, [
    "appointmentNumber",
    "patient.name",
    "patient.email",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<IAppointment>(Appointment, q, {
    sort: sortSpec(params.sort, params.dir, APPOINTMENT_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
    maxPageSize: 200,
  });
}

export async function listAppointmentsByUser(userId: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(userId)) return [];
  return Appointment.find({ userId, deletedAt: null })
    .sort({ createdAt: -1 })
    .lean<Lean<IAppointment>[]>()
    .exec();
}

export async function countOpenAppointments(): Promise<number> {
  await connectToDatabase();
  return Appointment.countDocuments({
    deletedAt: null,
    status: "pending",
  } as unknown as Filter);
}

export async function addAppointmentNote(
  id: string,
  authorId: string,
  body: string,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Appointment.findByIdAndUpdate(
    id,
    {
      $push: {
        activity: {
          authorId: new mongoose.Types.ObjectId(authorId),
          body,
          at: new Date(),
        },
      },
    },
    { new: true },
  ).exec();
}

export async function setAppointmentAssignee(
  id: string,
  assignedTo: string | null,
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return Appointment.findByIdAndUpdate(
    id,
    { assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null },
    { new: true },
  ).exec();
}
