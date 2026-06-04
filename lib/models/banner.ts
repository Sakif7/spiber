import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { BannerSlot } from "@/lib/schemas/banner";

export interface IBanner {
  slot: BannerSlot;
  title: LocalizedDoc;
  subtitle?: LocalizedDoc;
  image?: string;
  href?: string;
  cta?: LocalizedDoc;
  position: number;
  active: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<IBanner>(
  {
    slot: {
      type: String,
      enum: ["hero", "deal", "strip"],
      required: true,
    },
    title: { ...localizedDef },
    subtitle: { en: { type: String }, bn: { type: String } },
    image: { type: String },
    href: { type: String },
    cta: { en: { type: String }, bn: { type: String } },
    position: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { collection: "marketplace_banners", timestamps: true },
);

bannerSchema.index({ slot: 1, active: 1, position: 1 });

export const Banner: Model<IBanner> =
  (mongoose.models.Banner as Model<IBanner>) ??
  mongoose.model<IBanner>("Banner", bannerSchema);
