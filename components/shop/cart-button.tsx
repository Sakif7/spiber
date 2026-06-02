"use client";

import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart } from "./use-cart";

const MotionLink = motion.create(Link);

/**
 * Cart icon for the marketing navbar. Shows a live item-count badge from the
 * shared ["cart"] query. Count is 0 on the server/first paint (no badge), then
 * hydrates after the cart fetch — so there's no hydration mismatch.
 */
export function CartButton() {
  const { count } = useCart();
  const label =
    count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart";

  return (
    <MotionLink
      href="/instruments/cart"
      aria-label={label}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        borderRadius: 999,
        color: "var(--color-text)",
        cursor: "pointer",
      }}
    >
      <ShoppingBag size={19} strokeWidth={1.8} aria-hidden />
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 24 }}
          style={{
            position: "absolute",
            top: 1,
            right: 1,
            minWidth: 17,
            height: 17,
            padding: "0 4px",
            display: "grid",
            placeItems: "center",
            borderRadius: 999,
            background: "var(--color-brand)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
            boxShadow: "0 0 0 2px var(--color-surface)",
          }}
          aria-hidden
        >
          {count > 99 ? "99+" : count}
        </motion.span>
      )}
    </MotionLink>
  );
}
