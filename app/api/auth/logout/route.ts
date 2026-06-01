import { ok } from "@/lib/http/respond";
import { clearAuthCookies } from "@/lib/auth/session";

export async function POST() {
  await clearAuthCookies();
  return ok({});
}
