import { connectToDatabase } from "@/lib/db/connect";
import {
  CreditAccount,
  type ICreditAccount,
} from "@/lib/models/credit-account";
import type { Lean } from "@/lib/models/_shared";

/**
 * The checkout gate. Returns the account ONLY when it is live and active, so a
 * suspension takes effect on the very next order with no cache to invalidate.
 */
export async function getActiveCreditAccount(
  userId: string,
): Promise<Lean<ICreditAccount> | null> {
  await connectToDatabase();
  return CreditAccount.findOne({ userId, status: "active", deletedAt: null })
    .lean<Lean<ICreditAccount>>()
    .exec();
}

/** Any live account (active OR suspended) — used to block re-application. */
export async function getCreditAccountByUserId(
  userId: string,
): Promise<Lean<ICreditAccount> | null> {
  await connectToDatabase();
  return CreditAccount.findOne({ userId, deletedAt: null })
    .lean<Lean<ICreditAccount>>()
    .exec();
}

export async function getCreditAccountById(
  id: string,
): Promise<Lean<ICreditAccount> | null> {
  await connectToDatabase();
  return CreditAccount.findOne({ _id: id, deletedAt: null })
    .lean<Lean<ICreditAccount>>()
    .exec();
}

export async function createCreditAccount(
  data: Partial<ICreditAccount>,
): Promise<Lean<ICreditAccount>> {
  await connectToDatabase();
  const doc = await CreditAccount.create(data);
  return doc.toObject() as Lean<ICreditAccount>;
}

export async function listCreditAccounts(params: {
  status?: "active" | "suspended";
  page?: number;
  pageSize?: number;
}): Promise<{ items: Lean<ICreditAccount>[]; total: number }> {
  await connectToDatabase();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 30));
  const filter: Record<string, unknown> = { deletedAt: null };
  if (params.status) filter.status = params.status;
  const [items, total] = await Promise.all([
    CreditAccount.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<ICreditAccount>[]>()
      .exec(),
    CreditAccount.countDocuments(filter).exec(),
  ]);
  return { items, total };
}

export async function updateCreditAccount(
  id: string,
  data: Partial<Pick<ICreditAccount, "termsDays" | "status" | "notes">>,
): Promise<Lean<ICreditAccount> | null> {
  await connectToDatabase();
  return CreditAccount.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: data },
    { returnDocument: "after" },
  )
    .lean<Lean<ICreditAccount>>()
    .exec();
}

export async function countActiveCreditAccounts(): Promise<number> {
  await connectToDatabase();
  return CreditAccount.countDocuments({
    status: "active",
    deletedAt: null,
  }).exec();
}

export type { ICreditAccount };
