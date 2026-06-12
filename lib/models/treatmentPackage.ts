import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import { costRangeSchema, type ICostRange } from "./destination";
import type {
  TourismStatus,
  TreatmentCategory,
} from "@/lib/schemas/tourism-catalog";

/**
 * TreatmentPackage — a surgery or health-check package (cardiac/ortho/neuro/
 * oncology/IVF/cosmetic/health-check) with hospital options + an estimated cost
 * range + inclusions. A REAL DB catalog, filterable by category.
 */
export interface ITreatmentPackage {
  name: LocalizedDoc;
  slug: string;
  category: TreatmentCategory;
  description?: LocalizedDoc;
  hospitalOptionIds: (mongoose.Types.ObjectId | string)[];
  costRange?: ICostRange | null;
  inclusions: LocalizedDoc[];
  status: TourismStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const packageSchema = new Schema<ITreatmentPackage>(
  {
    name: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "cardiac",
        "ortho",
        "neuro",
        "oncology",
        "ivf",
        "cosmetic",
        "health-check",
      ],
      required: true,
      index: true,
    },
    description: { en: { type: String }, bn: { type: String } },
    hospitalOptionIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Hospital" }],
      default: [],
    },
    costRange: { type: costRangeSchema(), default: null },
    inclusions: { type: [localizedDef], default: [] },
    status: {
      type: String,
      enum: ["draft", "active"],
      default: "draft",
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "tourism_packages", timestamps: true },
);

packageSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
packageSchema.index({ "name.en": "text", "name.bn": "text" });
packageSchema.index({ status: 1, category: 1, createdAt: -1 });

export const TreatmentPackage: Model<ITreatmentPackage> =
  (mongoose.models.TreatmentPackage as Model<ITreatmentPackage>) ??
  mongoose.model<ITreatmentPackage>("TreatmentPackage", packageSchema);
