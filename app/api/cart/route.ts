import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import {
  addToCartSchema,
  updateCartItemSchema,
  removeCartItemSchema,
} from "@/lib/schemas/cart";
import {
  getCartView,
  addToCart,
  updateCartItem,
  removeCartItem,
} from "@/lib/services/cart.service";
import { resolveCartOwner } from "@/lib/shop/cart-owner";
import type { Locale } from "@/i18n/routing";
import { asLocale } from "@/lib/i18n/intl-locale";

function readLocale(req: Request): Locale {
  return asLocale(new URL(req.url).searchParams.get("locale"));
}

export async function GET(req: Request) {
  const owner = await resolveCartOwner();
  return ok(await getCartView(owner, readLocale(req)));
}

export async function POST(req: Request) {
  const parsed = await parseJson(req, addToCartSchema);
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);
  const owner = await resolveCartOwner();
  try {
    await addToCart(
      owner,
      parsed.data.productId,
      parsed.data.qty,
      parsed.data.variantId ?? null,
    );
  } catch {
    return fail({ code: "product_unavailable" }, 400);
  }
  return ok(await getCartView(owner, readLocale(req)));
}

export async function PATCH(req: Request) {
  const parsed = await parseJson(req, updateCartItemSchema);
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);
  const owner = await resolveCartOwner();
  await updateCartItem(
    owner,
    parsed.data.productId,
    parsed.data.qty,
    parsed.data.variantId ?? null,
  );
  return ok(await getCartView(owner, readLocale(req)));
}

export async function DELETE(req: Request) {
  const parsed = await parseJson(req, removeCartItemSchema);
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);
  const owner = await resolveCartOwner();
  await removeCartItem(
    owner,
    parsed.data.productId,
    parsed.data.variantId ?? null,
  );
  return ok(await getCartView(owner, readLocale(req)));
}
