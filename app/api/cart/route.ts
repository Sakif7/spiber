import { z } from "zod";
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
import type { Storefront } from "@/lib/schemas/catalog";
import type { Locale } from "@/i18n/routing";
import { asLocale } from "@/lib/i18n/intl-locale";

function readLocale(req: Request): Locale {
  return asLocale(new URL(req.url).searchParams.get("locale"));
}

/**
 * Which of the caller's own carts to act on. Safe to take from the client: it
 * only selects between carts the caller already owns, and `addToCart` re-checks
 * that the product actually belongs to that storefront.
 */
const storefrontParam = z
  .enum(["instruments", "marketplace"])
  .catch("marketplace");

function readStorefront(req: Request): Storefront {
  return storefrontParam.parse(new URL(req.url).searchParams.get("storefront"));
}

export async function GET(req: Request) {
  const owner = await resolveCartOwner();
  return ok(await getCartView(owner, readLocale(req), readStorefront(req)));
}

export async function POST(req: Request) {
  const parsed = await parseJson(req, addToCartSchema);
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);
  const owner = await resolveCartOwner();
  const storefront = readStorefront(req);
  try {
    await addToCart(
      owner,
      parsed.data.productId,
      parsed.data.qty,
      parsed.data.variantId ?? null,
      storefront,
    );
  } catch {
    return fail({ code: "product_unavailable" }, 400);
  }
  return ok(await getCartView(owner, readLocale(req), storefront));
}

export async function PATCH(req: Request) {
  const parsed = await parseJson(req, updateCartItemSchema);
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);
  const owner = await resolveCartOwner();
  const storefront = readStorefront(req);
  await updateCartItem(
    owner,
    parsed.data.productId,
    parsed.data.qty,
    parsed.data.variantId ?? null,
    storefront,
  );
  return ok(await getCartView(owner, readLocale(req), storefront));
}

export async function DELETE(req: Request) {
  const parsed = await parseJson(req, removeCartItemSchema);
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);
  const owner = await resolveCartOwner();
  const storefront = readStorefront(req);
  await removeCartItem(
    owner,
    parsed.data.productId,
    parsed.data.variantId ?? null,
    storefront,
  );
  return ok(await getCartView(owner, readLocale(req), storefront));
}
