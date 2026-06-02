import { ok, fail } from "@/lib/http/respond";
import { findOrderForGuest } from "@/lib/repositories/orders.repo";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderNumber = url.searchParams.get("orderNumber");
  const email = url.searchParams.get("email");
  if (!orderNumber || !email) return fail({ code: "invalid_input" }, 400);

  const order = await findOrderForGuest(orderNumber, email);
  if (!order) return fail({ code: "not_found" }, 404);
  return ok({ order });
}
