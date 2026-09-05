import { connectToDatabase } from "@/lib/db/connect";
import {
  CreditAccount,
  type ICreditAccount,
} from "@/lib/models/credit-account";
import type { Lean } from "@/lib/models/_shared";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

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

/** Sort keys the admin credit-accounts list exposes → stored fields. */
const CREDIT_ACCOUNT_SORT: Record<string, string> = {
  date: "createdAt",
  organization: "organization",
  terms: "termsDays",
  status: "status",
};

export type CreditAccountListParams = RepoListQuery & {
  status?: "active" | "suspended";
};

export async function listCreditAccounts(params: CreditAccountListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  applyPartialSearch(q, params.search, ["organization"]);
  applyDateRange(q, params.from, params.to);
  return paginate<ICreditAccount>(CreditAccount, q, {
    sort: sortSpec(params.sort, params.dir, CREDIT_ACCOUNT_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 30,
  });
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
