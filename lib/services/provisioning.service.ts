import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { type IProvisioningTask } from "@/lib/models/provisioningTask";
import { getTaskById } from "@/lib/repositories/provisioning.repo";
import type { ProvisioningStatus } from "@/lib/schemas/systems";

export type ProvisioningUpdateResult =
  | { ok: true; task: IProvisioningTask }
  | { ok: false; code: "not_found" };

/**
 * Update a provisioning task's status. When marked `done` the actor + time are
 * recorded (the external app's super admin activated the user out-of-band).
 */
export async function updateProvisioningStatus(
  id: string,
  to: ProvisioningStatus,
  opts: { note?: string; actorId?: string } = {},
): Promise<ProvisioningUpdateResult> {
  await connectToDatabase();
  const task = await getTaskById(id);
  if (!task) return { ok: false, code: "not_found" };

  task.status = to;
  if (opts.note) task.note = opts.note;
  if (to === "done") {
    task.activatedAt = new Date();
    if (opts.actorId) {
      task.activatedBy = new mongoose.Types.ObjectId(opts.actorId);
    }
  }
  await task.save();
  return { ok: true, task: task.toObject() };
}
