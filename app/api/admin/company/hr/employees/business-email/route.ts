import { ok, fail } from "@/lib/http/respond";
import { checkBusinessEmail } from "@/lib/services/hr/employee-access.service";
import { guardSales } from "../../../sales/_guard";

export const dynamic = "force-dynamic";

/** `?local=faria` → is faria@<domain> free? Typed-as-you-go by the form. */
export async function GET(req: Request) {
  const g = await guardSales("hr-read", 240);
  if (!g.ok) return g.res;
  const local = new URL(req.url).searchParams.get("local") ?? "";
  if (!local.trim()) return fail({ code: "invalid_input" }, 400);
  return ok(await checkBusinessEmail(local));
}
