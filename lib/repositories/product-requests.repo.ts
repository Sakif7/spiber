import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  ProductRequest,
  type IProductRequest,
} from "@/lib/models/product-request";
import type { Lean } from "@/lib/models/_shared";
import type { ProductRequestStatus } from "@/lib/schemas/product-request";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

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

/** Sort keys the admin product-requests list exposes → stored fields. */
const PRODUCT_REQUEST_SORT: Record<string, string> = {
  date: "createdAt",
  number: "requestNumber",
  product: "productName",
  name: "name",
  status: "status",
  qty: "quantity",
};

export type ProductRequestListParams = RepoListQuery & {
  status?: ProductRequestStatus;
  assignedTo?: string;
};

export async function listProductRequests(
  params: ProductRequestListParams = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.status) q.status = params.status;
  if (params.assignedTo && mongoose.isValidObjectId(params.assignedTo)) {
    q.assignedTo = params.assignedTo;
  }
  applyPartialSearch(q, params.search, [
    "requestNumber",
    "productName",
    "name",
    "email",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<IProductRequest>(ProductRequest, q, {
    sort: sortSpec(params.sort, params.dir, PRODUCT_REQUEST_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
  });
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
