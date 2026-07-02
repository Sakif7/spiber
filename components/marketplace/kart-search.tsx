"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

/**
 * Prominent homepage search — navigates to the Shop page with the query applied
 * (`/kart/shop?q=…`), where the faceted listing takes over. Kept intentionally
 * simple (no dropdown); the global header search provides cross-division
 * typeahead.
 */
export function KartSearch({
  placeholder,
  label,
}: {
  placeholder: string;
  label: string;
}) {
  const [q, setQ] = useState("");
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(
          term ? `/kart/shop?q=${encodeURIComponent(term)}` : "/kart/shop",
        );
      }}
      role="search"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        maxWidth: 620,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-pill)",
        padding: "6px 6px 6px 18px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Search
        size={20}
        strokeWidth={1.75}
        color="var(--color-text-muted)"
        aria-hidden
        style={{ flexShrink: 0 }}
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: "var(--fs-body)",
          fontFamily: "inherit",
          color: "var(--color-text)",
        }}
      />
      <button
        type="submit"
        style={{
          flexShrink: 0,
          background: "var(--color-brand)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--r-pill)",
          padding: "10px 22px",
          fontWeight: 600,
          fontSize: "var(--fs-body-sm)",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    </form>
  );
}
