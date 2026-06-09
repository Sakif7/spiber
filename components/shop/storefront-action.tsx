"use client";

import { usePathname } from "@/i18n/navigation";
import { CartButton } from "./cart-button";
import { QuoteButton } from "./quote-button";

/**
 * Header action that adapts to the current storefront:
 *  - /medtrade/* → "Request for Quotation" list (QuoteButton)
 *  - /marketplace/* → shopping cart (CartButton)
 *  - everywhere else → nothing (no shopping affordance on corporate pages)
 *
 * `usePathname` (from next-intl) is locale-stripped and stable on the client,
 * so only the relevant query (cart OR quote-list) fires per route — and there's
 * no hydration mismatch.
 */
export function StorefrontAction() {
  const pathname = usePathname();
  if (pathname.startsWith("/medtrade")) return <QuoteButton />;
  if (pathname.startsWith("/marketplace")) return <CartButton />;
  return null;
}
