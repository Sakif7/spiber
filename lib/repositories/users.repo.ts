import { connectToDatabase } from "@/lib/db/connect";
import { User, type IUser } from "@/lib/models/user";

export async function findUserByEmail(email: string) {
  await connectToDatabase();
  return User.findOne({ email }).exec();
}

export async function findUserById(id: string) {
  await connectToDatabase();
  return User.findById(id).exec();
}

export async function createUser(
  data: Pick<IUser, "name" | "email" | "passwordHash" | "roles" | "locale">,
) {
  await connectToDatabase();
  return User.create(data);
}

export async function markEmailVerified(id: string) {
  await connectToDatabase();
  await User.updateOne({ _id: id }, { $set: { emailVerified: true } }).exec();
}

/** Grant a role idempotently (e.g. "seller" when a seller application is approved). */
export async function addUserRole(id: string, role: IUser["roles"][number]) {
  await connectToDatabase();
  await User.updateOne({ _id: id }, { $addToSet: { roles: role } }).exec();
}

export async function updatePasswordHash(id: string, passwordHash: string) {
  await connectToDatabase();
  // Bump tokenVersion so every outstanding refresh/reset token is invalidated:
  // this both makes a reset link single-use and logs the user out everywhere.
  await User.updateOne(
    { _id: id },
    { $set: { passwordHash }, $inc: { tokenVersion: 1 } },
  ).exec();
}
