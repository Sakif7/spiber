import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { GalleryStatus } from "@/lib/schemas/gallery";

const optionalLocalized = { en: { type: String }, bn: { type: String } };

export interface IGalleryImage {
  url: string;
  caption?: LocalizedDoc;
}

export interface IGalleryAlbum {
  title: LocalizedDoc;
  slug: string;
  description?: LocalizedDoc;
  coverImage?: string;
  /** When the album's event/work happened (drives ordering + display). */
  date?: Date | null;
  images: IGalleryImage[];
  status: GalleryStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const galleryImageSchema = new Schema<IGalleryImage>(
  { url: { type: String, required: true }, caption: optionalLocalized },
  { _id: false },
);

const galleryAlbumSchema = new Schema<IGalleryAlbum>(
  {
    title: { ...localizedDef },
    slug: { type: String, required: true, trim: true },
    description: optionalLocalized,
    coverImage: { type: String },
    date: { type: Date, default: null },
    images: { type: [galleryImageSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "gallery_albums", timestamps: true },
);

// Unique slug among non-deleted albums (soft-deleted rows free their slug).
galleryAlbumSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
galleryAlbumSchema.index({ status: 1, date: -1, createdAt: -1 });

export const GalleryAlbum: Model<IGalleryAlbum> =
  (mongoose.models.GalleryAlbum as Model<IGalleryAlbum>) ??
  mongoose.model<IGalleryAlbum>("GalleryAlbum", galleryAlbumSchema);
