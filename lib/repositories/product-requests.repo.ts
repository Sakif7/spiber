import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  ProductRequest,
  type IProductRequest,
} from "@/lib/models/product-request";
import type { Lean } from "@/lib/models/_shared";
import type { ProductRequestStatus } from "@/lib/schemas/product-request";

type PRFilter = NonNullable<
  Parameters<typeof ProductRequest.countDocuments>[0]
>;

export async function createProductRequest(data: Partial<IProductRequest>) {
  await connectToDatabase();
  return ProductRequest.create(data);
}

export async function getProductRequestById(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return ProductRequest.findById(id).exec();
}

export async function getProductRequestByIdLean(id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return ProductRequest.findById(id).lean<Lean<IProductRequest>>().exec();
}

export type ProductRequestListParams = {
  status?: ProductRequestStatus;
  assignedTo?: string;
  page?: number;
  pageSize?: number;
};

export async function listProductRequests(
  params: ProductRequestListParams = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.status) q.status = params.status;
  if (params.assignedTo) q.assignedTo = params.assignedTo;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const filter = q as unknown as PRFilter;
  const [items, total] = await Promise.all([
    ProductRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IProductRequest>[]>()
      .exec(),
    ProductRequest.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Open (not fulfilled/declined) product-request count for the dashboard KPI. */
export async function countOpenProductRequests(): Promise<number> {
  await connectToDatabase();
  return ProductRequest.countDocuments({
    status: { $in: ["new", "reviewing", "sourcing", "quoted"] },
  } as unknown as PRFilter);
}

export async function addProductRequestNote(
  id: string,
  authorId: string,
  body: string,
) {
  await connectToDatabase();
  return ProductRequest.findByIdAndUpdate(
    id,
    {
      $push: {
        notes: {
          authorId: new mongoose.Types.ObjectId(authorId),
          body,
          at: new Date(),
        },
      },
    },
    { new: true },
  ).exec();
}

export async function setProductRequestAssignee(
  id: string,
  assignedTo: string | null,
) {
  await connectToDatabase();
  return ProductRequest.findByIdAndUpdate(
    id,
    { assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null },
    { new: true },
  ).exec();
}
