"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

/**
 * Listing-toolbar sort control (lives beside the result count, not in the
 * filter sidebar). Applies itself instantly — router.replace in a transition,
 * so the grid re-renders in place with no veil and no scroll jump.
 */
export function SortSelect({ showRating = false }: { showRating?: boolean }) {
  const t = useTranslations("shop.listing");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const value = sp.get("sort") ?? "newest";

  function onChange(next: string) {
    const p = new URLSearchParams(sp.toString());
    if (next === "newest") p.delete("sort");
    else p.set("sort", next);
    p.delete("page");
    const qs = p.toString();
    startTransition(() =>
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
    );
  }

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: "var(--fs-body-sm)",
        color: "var(--color-text-muted)",
        opacity: isPending ? 0.6 : 1,
        transition: "opacity 150ms",
      }}
    >
      {t("sortBy")}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 38,
          padding: "0 10px",
          border: "1px solid var(--color-border-field)",
          borderRadius: "var(--r-sm)",
          font: "inherit",
          background: "var(--color-surface)",
          color: "var(--color-text)",
          cursor: "pointer",
        }}
      >
        <option value="newest">{t("sortNewest")}</option>
        {showRating && <option value="rating_desc">{t("sortTopRated")}</option>}
        <option value="price_asc">{t("sortPriceAsc")}</option>
        <option value="price_desc">{t("sortPriceDesc")}</option>
      </select>
    </label>
  );
}
