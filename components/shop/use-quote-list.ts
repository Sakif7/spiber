"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";

export type QuoteLine = {
  productId: string;
  variantId: string | null;
  slug: string;
  sku: string;
  name: string;
  variantLabel?: string;
  image?: string;
  qty: number;
};

export type QuoteList = { items: QuoteLine[]; count: number };

export type QuoteMutationInput = {
  productId: string;
  qty?: number;
  variantId?: string | null;
};

async function quoteApi(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  locale: string,
  body?: unknown,
): Promise<QuoteList> {
  const res = await fetch(`/api/quote-list?locale=${locale}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json?.error?.code ?? "quote_error");
  return json.data as QuoteList;
}

/** The Instruments "Request for Quotation" list (server-backed), cached. */
export function useQuoteList() {
  const locale = useLocale();
  const qc = useQueryClient();
  const set = (q: QuoteList) => qc.setQueryData(["quote-list"], q);

  const query = useQuery({
    queryKey: ["quote-list"],
    queryFn: () => quoteApi("GET", locale),
  });

  const add = useMutation({
    mutationFn: (v: QuoteMutationInput) => quoteApi("POST", locale, v),
    onSuccess: set,
  });
  const update = useMutation({
    mutationFn: (v: QuoteMutationInput) => quoteApi("PATCH", locale, v),
    onSuccess: set,
  });
  const remove = useMutation({
    mutationFn: (v: { productId: string; variantId?: string | null }) =>
      quoteApi("DELETE", locale, v),
    onSuccess: set,
  });

  return {
    list: query.data,
    isLoading: query.isLoading,
    count: query.data?.count ?? 0,
    add,
    update,
    remove,
  };
}
