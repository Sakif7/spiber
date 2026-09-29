import { ok } from "@/lib/http/respond";
import { signatureChoices } from "@/lib/services/mail.service";
import { guardMailbox } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ address: string }> };

/**
 * The signatures the composer may put under a message from this mailbox:
 * the owner's for a personal one, everyone's for a shared one.
 */
export async function GET(_req: Request, { params }: Params) {
  const { address } = await params;
  const g = await guardMailbox(address, "list");
  if (!g.ok) return g.res;
  return ok(await signatureChoices(g.access, g.claims));
}
