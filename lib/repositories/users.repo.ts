import { connectToDatabase } from "@/lib/db/connect";
import { User, type IUser } from "@/lib/models/user";
import mongoose from "mongoose";

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

export async function updateUserProfile(
  id: string,
  patch: Pick<IUser, "name"> & Partial<Pick<IUser, "phone" | "defaultAddress">>,
) {
  await connectToDatabase();
  return User.findByIdAndUpdate(
    id,
    { $set: patch },
    { returnDocument: "after", runValidators: true },
  ).exec();
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

/** Raw stored admin prefs (null when never set). Callers sanitize. */
export async function getAdminPrefsRaw(id: string) {
  await connectToDatabase();
  const doc = await User.findById(id).select("adminPrefs").lean().exec();
  return doc?.adminPrefs ?? null;
}

/** Replace the admin prefs wholesale (the API computes the next value). */
export async function setAdminPrefs(
  id: string,
  prefs: { favourites: string[]; recents: { id: string; at: Date }[] },
) {
  await connectToDatabase();
  await User.updateOne({ _id: id }, { $set: { adminPrefs: prefs } }).exec();
}

/** Display names for a set of user ids (e.g. the admin column on the stock ledger). */
export async function userNamesByIds(
  ids: string[],
): Promise<Record<string, string>> {
  await connectToDatabase();
  const valid = [...new Set(ids)].filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return {};
  const rows = await User.find({ _id: { $in: valid } })
    .select("_id name email")
    .lean<{ _id: mongoose.Types.ObjectId; name?: string; email: string }[]>()
    .exec();
  return Object.fromEntries(
    rows.map((r) => [String(r._id), r.name || r.email]),
  );
}
