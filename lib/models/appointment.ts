import mongoose, { Schema, type Model } from "mongoose";
import type {
  AppointmentStatus,
  AppointmentType,
} from "@/lib/schemas/appointment";

export interface IAppointmentActivity {
  authorId: mongoose.Types.ObjectId | string;
  body: string;
  at: Date;
}

export interface IAppointment {
  appointmentNumber: string;
  patient: { name: string; email: string; phone: string };
  userId?: mongoose.Types.ObjectId | string | null;
  doctorId?: mongoose.Types.ObjectId | string | null;
  type: AppointmentType;
  preferredTimes: string[];
  notes?: string;
  status: AppointmentStatus;
  meetingLink?: string | null;
  scheduledFor?: Date | null;
  assignedTo?: mongoose.Types.ObjectId | string | null;
  activity: IAppointmentActivity[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    appointmentNumber: { type: String, required: true, unique: true },
    patient: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true, trim: true },
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    doctorId: { type: Schema.Types.ObjectId, ref: "Doctor", default: null },
    type: {
      type: String,
      enum: ["in_person", "teleconsultation"],
      required: true,
    },
    preferredTimes: { type: [String], default: [] },
    notes: { type: String },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    meetingLink: { type: String, default: null },
    scheduledFor: { type: Date, default: null },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    activity: {
      type: [
        new Schema<IAppointmentActivity>(
          {
            authorId: { type: Schema.Types.ObjectId, ref: "User" },
            body: String,
            at: Date,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "tourism_appointments", timestamps: true },
);

appointmentSchema.index({ status: 1, createdAt: -1 });
appointmentSchema.index({ assignedTo: 1, status: 1 });

export const Appointment: Model<IAppointment> =
  (mongoose.models.Appointment as Model<IAppointment>) ??
  mongoose.model<IAppointment>("Appointment", appointmentSchema);
