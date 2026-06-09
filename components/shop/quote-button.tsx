"use client";

import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useQuoteList } from "./use-quote-list";

const MotionLink = motion.create(Link);

/**
 * "Request for Quotation" indicator for the Instruments header. Shows a live
 * count from the shared ["quote-list"] query — 0 on first paint (no badge),
 * then hydrates after the fetch, so no hydration mismatch.
 */
export function QuoteButton() {
  const { count } = useQuoteList();
  const label =
    count > 0
      ? `Quote list, ${count} item${count === 1 ? "" : "s"}`
      : "Quote list";

  return (
    <MotionLink
      href="/medtrade/quote"
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
      <FileText size={19} strokeWidth={1.8} aria-hidden />
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
