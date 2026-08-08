import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { profileUpdateSchema } from "@/lib/schemas/user";
import { getSessionUser } from "@/lib/auth/current-user";
import { findUserById, updateUserProfile } from "@/lib/repositories/users.repo";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import type { IUser } from "@/lib/models/user";

function toProfile(doc: IUser & { _id: unknown }) {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    phone: doc.phone ?? "",
    defaultAddress: doc.defaultAddress ?? null,
    locale: doc.locale,
    createdAt: doc.createdAt,
  };
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return fail({ code: "unauthorized" }, 401);
  const doc = await findUserById(session.sub);
  if (!doc || doc.disabled) return fail({ code: "not_found" }, 404);
  return ok({ profile: toProfile(doc) });
}

export async function PATCH(req: Request) {
  const session = await getSessionUser();
  if (!session) return fail({ code: "unauthorized" }, 401);
  if (!rateLimit(`profile:${clientIp(req)}`, 20, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, profileUpdateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const doc = await updateUserProfile(session.sub, {
    name: parsed.data.name,
    phone: parsed.data.phone ?? "",
    defaultAddress: parsed.data.defaultAddress ?? null,
  });
  if (!doc) return fail({ code: "not_found" }, 404);
  return ok({ profile: toProfile(doc) });
}
