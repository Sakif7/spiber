import { connectToDatabase } from "@/lib/db/connect";
import {
  ChatConversation,
  type IChatConversation,
  type IChatLead,
  type IChatTurn,
} from "@/lib/models/chat-conversation";
import type { Lean } from "@/lib/models/_shared";
import type { ChatStatus } from "@/lib/schemas/chat";

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

export type ChatListParams = {
  status?: ChatStatus;
  /** Only conversations that captured a lead. */
  leadsOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export async function listChatConversations(params: ChatListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.leadsOnly) q.lead = { $ne: null };
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const filter = q as unknown as ChatFilter;
  const [items, total] = await Promise.all([
    ChatConversation.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IChatConversation>[]>()
      .exec(),
    ChatConversation.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
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
