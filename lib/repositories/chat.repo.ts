import { connectToDatabase } from "@/lib/db/connect";
import {
  ChatConversation,
  type IChatConversation,
  type IChatLead,
  type IChatTurn,
} from "@/lib/models/chat-conversation";
import type { Lean } from "@/lib/models/_shared";
import type { ChatStatus } from "@/lib/schemas/chat";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type ChatFilter = NonNullable<
  Parameters<typeof ChatConversation.countDocuments>[0]
>;

/** Keep transcripts bounded — retain the most recent turns only. */
const MAX_TURNS = 200;

export async function createConversation(data: Partial<IChatConversation>) {
  await connectToDatabase();
  return ChatConversation.create(data);
}

export async function getConversationByRef(ref: string) {
  await connectToDatabase();
  return ChatConversation.findOne({
    ref,
    deletedAt: null,
  } as unknown as ChatFilter)
    .lean<Lean<IChatConversation>>()
    .exec();
}

/**
 * Append turns to an existing conversation (capping the transcript) and store
 * the latest engine state. Returns the updated doc, or `null` if the ref is
 * unknown/deleted (caller then starts a fresh conversation).
 */
export async function appendTurns(
  ref: string,
  turns: IChatTurn[],
  state: IChatConversation["state"] | undefined,
) {
  await connectToDatabase();
  return ChatConversation.findOneAndUpdate(
    { ref, deletedAt: null } as unknown as ChatFilter,
    {
      $push: { messages: { $each: turns, $slice: -MAX_TURNS } },
      $set: { state: state ?? undefined },
    },
    { new: true },
  )
    .lean<Lean<IChatConversation>>()
    .exec();
}

/** Attach a captured lead + flip status to "lead". */
export async function attachLead(ref: string, lead: IChatLead) {
  await connectToDatabase();
  return ChatConversation.findOneAndUpdate(
    { ref, deletedAt: null } as unknown as ChatFilter,
    { $set: { lead, status: "lead" } },
    { new: true },
  )
    .lean<Lean<IChatConversation>>()
    .exec();
}

/* ── Admin ───────────────────────────────────────────────────────────────── */

/** Sort keys the admin list exposes → stored fields. */
const CHAT_SORT: Record<string, string> = {
  updated: "updatedAt",
  date: "createdAt",
  status: "status",
  ref: "ref",
};

export type ChatListParams = RepoListQuery & {
  status?: ChatStatus;
  /** Only conversations that captured a lead. */
  leadsOnly?: boolean;
};

export async function listChatConversations(params: ChatListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.leadsOnly) q.lead = { $ne: null };
  applyPartialSearch(q, params.search, [
    "ref",
    "lead.name",
    "lead.email",
    "lead.phone",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<IChatConversation>(ChatConversation, q, {
    sort: sortSpec(params.sort, params.dir, CHAT_SORT, {
      key: "updated",
      dir: "desc",
    }),
    page: params.page,
    pageSize: params.pageSize ?? 50,
  });
}

export async function getChatConversationById(id: string) {
  await connectToDatabase();
  return ChatConversation.findOne({
    _id: id,
    deletedAt: null,
  } as unknown as ChatFilter)
    .lean<Lean<IChatConversation>>()
    .exec();
}

export async function updateChatStatus(id: string, status: ChatStatus) {
  await connectToDatabase();
  return ChatConversation.findOneAndUpdate(
    { _id: id, deletedAt: null } as unknown as ChatFilter,
    { $set: { status } },
    { new: true },
  )
    .lean<Lean<IChatConversation>>()
    .exec();
}

export async function softDeleteChatConversation(id: string) {
  await connectToDatabase();
  return ChatConversation.findOneAndUpdate(
    { _id: id, deletedAt: null } as unknown as ChatFilter,
    { $set: { deletedAt: new Date() } },
    { new: true },
  )
    .lean<Lean<IChatConversation>>()
    .exec();
}

/** Captured leads that still need follow-up — for a dashboard KPI. */
export async function countChatLeads(): Promise<number> {
  await connectToDatabase();
  return ChatConversation.countDocuments({
    status: "lead",
    deletedAt: null,
  } as unknown as ChatFilter);
}
