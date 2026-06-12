import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Appointment, type IAppointment } from "@/lib/models/appointment";
import type { Lean } from "@/lib/models/_shared";
import type { AppointmentStatus } from "@/lib/schemas/appointment";

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

export type AppointmentListParams = {
  status?: AppointmentStatus;
  assignedTo?: string;
  page?: number;
  pageSize?: number;
};

export async function listAppointments(params: AppointmentListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.assignedTo && mongoose.isValidObjectId(params.assignedTo)) {
    q.assignedTo = params.assignedTo;
  }
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));
  const filter = q as unknown as Filter;
  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IAppointment>[]>()
      .exec(),
    Appointment.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
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
