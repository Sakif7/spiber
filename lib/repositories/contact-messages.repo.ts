import { connectToDatabase } from "@/lib/db/connect";
import {
  ContactMessage,
  type IContactMessage,
} from "@/lib/models/contact-message";
import type { Lean } from "@/lib/models/_shared";
import type { ContactStatus } from "@/lib/schemas/contact";

type ContactFilter = NonNullable<
  Parameters<typeof ContactMessage.countDocuments>[0]
>;

export async function createContactMessage(data: Partial<IContactMessage>) {
  await connectToDatabase();
  return ContactMessage.create(data);
}

export type ContactListParams = {
  status?: ContactStatus;
  page?: number;
  pageSize?: number;
};

export async function listContactMessages(params: ContactListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const filter = q as unknown as ContactFilter;
  const [items, total] = await Promise.all([
    ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IContactMessage>[]>()
      .exec(),
    ContactMessage.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Unread (new) message count — for a future admin dashboard KPI. */
export async function countNewContactMessages(): Promise<number> {
  await connectToDatabase();
  return ContactMessage.countDocuments({
    status: "new",
    deletedAt: null,
  } as unknown as ContactFilter);
}
