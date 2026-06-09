import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { EventStatus } from "@/lib/schemas/events";

const optionalLocalized = { en: { type: String }, bn: { type: String } };

export interface IEvent {
  title: LocalizedDoc;
  slug: string;
  summary?: LocalizedDoc;
  description: LocalizedDoc;
  coverImage?: string;
  startDate: Date;
  endDate?: Date | null;
  location?: LocalizedDoc;
  registrationUrl?: string;
  status: EventStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    title: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    summary: optionalLocalized,
    description: { ...localizedDef },
    coverImage: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    location: optionalLocalized,
    registrationUrl: { type: String },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "events", timestamps: true },
);

// Unique slug among non-deleted events (soft-deleted rows free their slug).
eventSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
eventSchema.index({ status: 1, startDate: 1 });

export const Event: Model<IEvent> =
  (mongoose.models.Event as Model<IEvent>) ??
  mongoose.model<IEvent>("Event", eventSchema);
