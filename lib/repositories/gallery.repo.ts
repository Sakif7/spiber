import { connectToDatabase } from "@/lib/db/connect";
import { GalleryAlbum, type IGalleryAlbum } from "@/lib/models/galleryAlbum";
import type { Lean } from "@/lib/models/_shared";
import type { GalleryStatus } from "@/lib/schemas/gallery";
import { applyPartialSearch } from "@/lib/repositories/search-filter";
import {
  applyDateRange,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type AlbumFilter = NonNullable<
  Parameters<typeof GalleryAlbum.countDocuments>[0]
>;

export type PublicAlbumListParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};

// ---- Public ----
export async function listPublishedAlbums(params: PublicAlbumListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null, status: "published" };
  applyPartialSearch(q, params.search, [
    "title.en",
    "title.bn",
    "description.en",
    "description.bn",
  ]);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? 12));
  const filter = q as unknown as AlbumFilter;
  const [items, total] = await Promise.all([
    GalleryAlbum.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IGalleryAlbum>[]>()
      .exec(),
    GalleryAlbum.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getPublishedAlbumBySlug(slug: string) {
  await connectToDatabase();
  return GalleryAlbum.findOne({ slug, deletedAt: null, status: "published" })
    .lean<Lean<IGalleryAlbum>>()
    .exec();
}

/** Visible albums for the sitemap. */
export async function listVisibleAlbumsForFeed(limit = 100) {
  await connectToDatabase();
  return GalleryAlbum.find({
    deletedAt: null,
    status: "published",
  } as unknown as AlbumFilter)
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .lean<Lean<IGalleryAlbum>[]>()
    .exec();
}

// ---- Admin ----
/** Sort keys the admin list exposes → stored fields. */
const ADMIN_ALBUM_SORT: Record<string, string> = {
  date: "createdAt",
  title: "title.en",
  status: "status",
  albumDate: "date",
};

export type AdminAlbumListParams = RepoListQuery & {
  status?: GalleryStatus;
};

export async function listAdminAlbums(params: AdminAlbumListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  applyPartialSearch(q, params.search, ["title.en", "title.bn"]);
  applyDateRange(q, params.from, params.to);
  return paginate<IGalleryAlbum>(GalleryAlbum, q, {
    sort: sortSpec(params.sort, params.dir, ADMIN_ALBUM_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
  });
}

export async function getAlbumByIdLean(id: string) {
  await connectToDatabase();
  return GalleryAlbum.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IGalleryAlbum>>()
    .exec();
}

export async function createAlbum(data: Partial<IGalleryAlbum>) {
  await connectToDatabase();
  return GalleryAlbum.create(data);
}

export async function updateAlbum(id: string, data: Partial<IGalleryAlbum>) {
  await connectToDatabase();
  return GalleryAlbum.findOneAndUpdate({ _id: id, deletedAt: null }, data, {
    new: true,
  }).exec();
}

/** Returns false when no such live record exists, so the route can 404. */
export async function softDeleteAlbum(id: string): Promise<boolean> {
  await connectToDatabase();
  const res = await GalleryAlbum.updateOne(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  ).exec();
  return res.matchedCount > 0;
}
