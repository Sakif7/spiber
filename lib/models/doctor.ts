import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { TourismStatus } from "@/lib/schemas/tourism-catalog";

/**
 * Doctor — a specialist in the network, filterable by specialty / hospital /
 * online-consultation. A REAL DB catalog. `name` is a person's name (plain
 * string, not localized); specialty/location/bio are bilingual.
 */
export interface IDoctor {
  name: string;
  slug: string;
  specialty: LocalizedDoc;
  hospitalId?: mongoose.Types.ObjectId | string | null;
  location?: LocalizedDoc;
  bio?: LocalizedDoc;
  photo?: string;
  onlineConsultation: boolean;
  status: TourismStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    specialty: { ...localizedDef },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
      index: true,
    },
    location: { en: { type: String }, bn: { type: String } },
    bio: { en: { type: String }, bn: { type: String } },
    photo: { type: String },
    onlineConsultation: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ["draft", "active"],
      default: "draft",
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "tourism_doctors", timestamps: true },
);

doctorSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
doctorSchema.index({
  name: "text",
  "specialty.en": "text",
  "specialty.bn": "text",
});
doctorSchema.index({ status: 1, onlineConsultation: 1, createdAt: -1 });

export const Doctor: Model<IDoctor> =
  (mongoose.models.Doctor as Model<IDoctor>) ??
  mongoose.model<IDoctor>("Doctor", doctorSchema);
