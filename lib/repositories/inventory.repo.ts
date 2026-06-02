import { connectToDatabase } from "@/lib/db/connect";
import {
  InventoryMovement,
  type IInventoryMovement,
} from "@/lib/models/inventoryMovement";
import type { Lean } from "@/lib/models/_shared";

export async function createMovement(data: Partial<IInventoryMovement>) {
  await connectToDatabase();
  return InventoryMovement.create(data);
}

export async function listMovementsByProduct(productId: string, limit = 100) {
  await connectToDatabase();
  return InventoryMovement.find({ productId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Lean<IInventoryMovement>[]>()
    .exec();
}
