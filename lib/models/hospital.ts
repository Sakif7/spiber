import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { TourismStatus } from "@/lib/schemas/tourism-catalog";

/**
 * Hospital — a partner facility in the medical-tourism network. (The brief said
 * "extend PartnerFacility", which was never built, so this is the canonical
 * facility model.) Bilingual content, filterable by country/specialty/
 * accreditation — a REAL DB catalog, not a request form.
 */
export interface IHospital {
  name: LocalizedDoc;
  slug: string;
  country: LocalizedDoc;
  city?: LocalizedDoc;
  accreditations: string[];
  specialties: LocalizedDoc[];
  profile?: LocalizedDoc;
  images: string[];
  destinationId?: mongoose.Types.ObjectId | string | null;
  status: TourismStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalSchema = new Schema<IHospital>(
  {
    name: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    country: { ...localizedDef },
    city: { en: { type: String }, bn: { type: String } },
    accreditations: { type: [String], default: [] },
    specialties: { type: [localizedDef], default: [] },
    profile: { en: { type: String }, bn: { type: String } },
    images: { type: [String], default: [] },
    destinationId: {
      type: Schema.Types.ObjectId,
      ref: "Destination",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "active"],
      default: "draft",
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "tourism_hospitals", timestamps: true },
);

hospitalSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
hospitalSchema.index({
  "name.en": "text",
  "name.bn": "text",
  "country.en": "text",
});
hospitalSchema.index({ status: 1, destinationId: 1, createdAt: -1 });

export const Hospital: Model<IHospital> =
  (mongoose.models.Hospital as Model<IHospital>) ??
  mongoose.model<IHospital>("Hospital", hospitalSchema);
