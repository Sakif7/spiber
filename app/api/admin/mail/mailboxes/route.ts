import { ok, fail } from "@/lib/http/respond";
import { requireStaff } from "@/lib/auth/guard";
import { accessibleMailboxes } from "@/lib/services/mail.service";

export const dynamic = "force-dynamic";

/** The mailboxes the signed-in person may open, own first. */
export async function GET() {
  const claims = await requireStaff();
  if (!claims) return fail({ code: "forbidden" }, 403);
  return ok({ mailboxes: await accessibleMailboxes(claims) });
}
