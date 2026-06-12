import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { TourismStatus } from "@/lib/schemas/tourism-catalog";

/**
 * Cost estimate shown to patients: a BDT range (integer poisha) + an optional,
 * clearly-labeled foreign-currency estimate. Shared by Destination + Package.
 */
export interface ICostRange {
  bdtMinMinor?: number | null;
  bdtMaxMinor?: number | null;
  foreignLabel?: string;
  foreignNote?: LocalizedDoc;
}

/** A new, reusable cost-range subdocument schema (no _id). */
export const costRangeSchema = () =>
  new Schema<ICostRange>(
    {
      bdtMinMinor: { type: Number, default: null, min: 0 },
      bdtMaxMinor: { type: Number, default: null, min: 0 },
      foreignLabel: { type: String },
      foreignNote: { en: { type: String }, bn: { type: String } },
    },
    { _id: false },
  );

export interface IDestination {
  name: LocalizedDoc;
  slug: string;
  heroImage?: string;
  overview?: LocalizedDoc;
  popularTreatments: LocalizedDoc[];
  costRange?: ICostRange | null;
  partnerHospitalIds: (mongoose.Types.ObjectId | string)[];
  featured: boolean;
  status: TourismStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const destinationSchema = new Schema<IDestination>(
  {
    name: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    heroImage: { type: String },
    overview: { en: { type: String }, bn: { type: String } },
    popularTreatments: { type: [localizedDef], default: [] },
    costRange: { type: costRangeSchema(), default: null },
    partnerHospitalIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Hospital" }],
      default: [],
    },
    featured: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "active"],
      default: "draft",
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "tourism_destinations", timestamps: true },
);

destinationSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
destinationSchema.index({ "name.en": "text", "name.bn": "text" });
destinationSchema.index({ status: 1, featured: -1, createdAt: -1 });

export const Destination: Model<IDestination> =
  (mongoose.models.Destination as Model<IDestination>) ??
  mongoose.model<IDestination>("Destination", destinationSchema);
