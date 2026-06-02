import { connectToDatabase } from "@/lib/db/connect";
import {
  ProvisioningTask,
  type IProvisioningTask,
} from "@/lib/models/provisioningTask";
import type { Lean } from "@/lib/models/_shared";
import type { ProvisioningStatus } from "@/lib/schemas/systems";

export async function getTaskByPurchaseId(purchaseId: string) {
  await connectToDatabase();
  return ProvisioningTask.findOne({ purchaseId }).exec();
}

export async function getTaskById(id: string) {
  await connectToDatabase();
  return ProvisioningTask.findById(id).exec();
}

export async function listProvisioningTasks(
  params: { status?: ProvisioningStatus } = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.status) q.status = params.status;
  return ProvisioningTask.find(q)
    .sort({ createdAt: -1 })
    .limit(200)
    .lean<Lean<IProvisioningTask>[]>()
    .exec();
}

export async function createProvisioningTask(data: Partial<IProvisioningTask>) {
  await connectToDatabase();
  return ProvisioningTask.create(data);
}

export async function countOpenProvisioningTasks(): Promise<number> {
  await connectToDatabase();
  return ProvisioningTask.countDocuments({
    status: { $in: ["open", "in_progress"] },
  });
}
