"use client";

import { usePathname } from "@/i18n/navigation";
import { CartButton } from "./cart-button";
import { QuoteButton } from "./quote-button";

/**
 * Header action that adapts to the current storefront:
 *  - /medtrade/* → cart + "Request for Quotation" list (priced instruments are
 *    buyable, price-less ones are quote-only, so both affordances belong here)
 *  - /kart/* → shopping cart (CartButton)
 *  - everywhere else → nothing (no shopping affordance on corporate pages)
 *
 * `usePathname` (from next-intl) is locale-stripped and stable on the client,
 * so only the relevant queries fire per route — and there's no hydration
 * mismatch.
 */
export function StorefrontAction() {
  const pathname = usePathname();
  if (pathname.startsWith("/medtrade")) {
    return (
      <>
        <CartButton storefront="instruments" />
        <QuoteButton />
      </>
    );
  }
  if (pathname.startsWith("/kart")) return <CartButton />;
  return null;
}
