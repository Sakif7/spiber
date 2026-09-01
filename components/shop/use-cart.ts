"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";

export type CartLine = {
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantLabel?: string;
  image?: string;
  priceMinor: number;
  qty: number;
  lineTotalMinor: number;
  stockQty: number;
  inStock: boolean;
};

export type Cart = {
  items: CartLine[];
  subtotalMinor: number;
  count: number;
};

export type CartMutationInput = {
  productId: string;
  qty?: number;
  variantId?: string | null;
};

/** Which storefront's cart to read/write. Each has its own server cart. */
export type CartStorefront = "instruments" | "marketplace";

async function cartApi(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  locale: string,
  storefront: CartStorefront,
  body?: unknown,
): Promise<Cart> {
  const res = await fetch(
    `/api/cart?locale=${locale}&storefront=${storefront}`,
    {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json?.error?.code ?? "cart_error");
  return json.data as Cart;
}

/**
 * Server cart (Mongo) accessed via /api/cart, cached with TanStack Query.
 * Carts are per storefront, so the query key is too — a Medtrade cart and a
 * Spiber Kart cart coexist without either clobbering the other's cache.
 */
export function useCart(storefront: CartStorefront = "marketplace") {
  const locale = useLocale();
  const qc = useQueryClient();
  const set = (c: Cart) => qc.setQueryData(["cart", storefront], c);

  const query = useQuery({
    queryKey: ["cart", storefront],
    queryFn: () => cartApi("GET", locale, storefront),
  });

  const add = useMutation({
    mutationFn: (v: CartMutationInput) =>
      cartApi("POST", locale, storefront, v),
    onSuccess: set,
  });
  const update = useMutation({
    mutationFn: (v: CartMutationInput) =>
      cartApi("PATCH", locale, storefront, v),
    onSuccess: set,
  });
  const remove = useMutation({
    mutationFn: (v: { productId: string; variantId?: string | null }) =>
      cartApi("DELETE", locale, storefront, v),
    onSuccess: set,
  });

  return {
    cart: query.data,
    isLoading: query.isLoading,
    count: query.data?.count ?? 0,
    add,
    update,
    remove,
  };
}
