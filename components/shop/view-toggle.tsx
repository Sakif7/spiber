"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, List } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

/**
 * Grid ⊞ / list ☰ view switch for the listing toolbar. URL-backed (`view=list`)
 * so the server renders the right layout directly — applied in place like every
 * other listing control (replace in a transition, no veil, no scroll jump).
 */
export function ViewToggle() {
  const t = useTranslations("shop.listing");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const view = sp.get("view") === "list" ? "list" : "grid";

  function setView(next: "grid" | "list") {
    if (next === view) return;
    const p = new URLSearchParams(sp.toString());
    if (next === "list") p.set("view", "list");
    else p.delete("view");
    const qs = p.toString();
    startTransition(() =>
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
    );
  }

  const btn = (active: boolean): React.CSSProperties => ({
    display: "inline-grid",
    placeItems: "center",
    width: 36,
    height: 36,
    border: "1px solid var(--color-border-field)",
    background: active ? "var(--color-brand)" : "var(--color-surface)",
    color: active ? "#fff" : "var(--color-text-muted)",
    cursor: active ? "default" : "pointer",
  });

  return (
    <div
      role="group"
      aria-label={t("view")}
      style={{
        display: "inline-flex",
        borderRadius: "var(--r-sm)",
        overflow: "hidden",
        opacity: isPending ? 0.6 : 1,
        transition: "opacity 150ms",
      }}
    >
      <button
        type="button"
        aria-pressed={view === "grid"}
        aria-label={t("viewGrid")}
        title={t("viewGrid")}
        onClick={() => setView("grid")}
        style={{
          ...btn(view === "grid"),
          borderRadius: "var(--r-sm) 0 0 var(--r-sm)",
        }}
      >
        <LayoutGrid size={17} strokeWidth={1.8} aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={view === "list"}
        aria-label={t("viewList")}
        title={t("viewList")}
        onClick={() => setView("list")}
        style={{
          ...btn(view === "list"),
          borderLeft: 0,
          borderRadius: "0 var(--r-sm) var(--r-sm) 0",
        }}
      >
        <List size={17} strokeWidth={1.8} aria-hidden />
      </button>
    </div>
  );
}
