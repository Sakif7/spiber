import { connectToDatabase } from "@/lib/db/connect";
import {
  ContactMessage,
  type IContactMessage,
} from "@/lib/models/contact-message";
import type { ContactStatus } from "@/lib/schemas/contact";
import {
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";

type ContactFilter = NonNullable<
  Parameters<typeof ContactMessage.countDocuments>[0]
>;

export async function createContactMessage(data: Partial<IContactMessage>) {
  await connectToDatabase();
  return ContactMessage.create(data);
}

/** Sort keys the admin list exposes → stored fields. */
const CONTACT_SORT: Record<string, string> = {
  date: "createdAt",
  name: "name",
  status: "status",
  type: "inquiryType",
};

export type ContactListParams = RepoListQuery & {
  status?: ContactStatus;
  inquiryType?: string;
};

export async function listContactMessages(params: ContactListParams = {}) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.inquiryType) q.inquiryType = params.inquiryType;
  applyPartialSearch(q, params.search, [
    "contactNumber",
    "name",
    "email",
    "phone",
    "message",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<IContactMessage>(ContactMessage, q, {
    sort: sortSpec(params.sort, params.dir, CONTACT_SORT),
    page: params.page,
    pageSize: params.pageSize ?? 50,
  });
}

/** Unread (new) message count — for a future admin dashboard KPI. */
export async function countNewContactMessages(): Promise<number> {
  await connectToDatabase();
  return ContactMessage.countDocuments({
    status: "new",
    deletedAt: null,
  } as unknown as ContactFilter);
}
