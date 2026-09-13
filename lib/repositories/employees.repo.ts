import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Employee, type IEmployee } from "@/lib/models/employee";
import type { Lean } from "@/lib/models/_shared";

/** The active employee record behind a signed-in user, if any. */
export async function findEmployeeByUserId(
  userId: string,
): Promise<Lean<IEmployee> | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(userId)) return null;
  return Employee.findOne({ userId, deletedAt: null })
    .lean<Lean<IEmployee>>()
    .exec();
}

export async function findEmployeeByBusinessEmail(
  email: string,
): Promise<Lean<IEmployee> | null> {
  await connectToDatabase();
  return Employee.findOne({
    businessEmail: email.trim().toLowerCase(),
    deletedAt: null,
  })
    .lean<Lean<IEmployee>>()
    .exec();
}
