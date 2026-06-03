"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { useSession } from "@/components/auth/use-session";
import { useAuthModal } from "@/components/auth/auth-modal";

/**
 * Login-required wishlist toggle. Rendered as a span[role=button] so it can live
 * inside a card-level <a> (a real <button> would be invalid there); clicks are
 * prevented from navigating. Not signed in → opens the auth modal.
 */
export function WishlistButton({
  productId,
  initialWishlisted = false,
  withLabel = false,
}: {
  productId: string;
  initialWishlisted?: boolean;
  withLabel?: boolean;
}) {
  const t = useTranslations("shop.wishlist");
  const { user } = useSession();
  const { open } = useAuthModal();
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialWishlisted);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (!user) {
      open("login", { next: pathname });
      return;
    }
    setBusy(true);
    const optimistic = !saved;
    setSaved(optimistic);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setSaved(json.data.wishlisted);
      else setSaved(!optimistic);
    } catch {
      setSaved(!optimistic);
    } finally {
      setBusy(false);
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") toggle(e);
  };
  const label = saved ? t("saved") : t("add");

  if (withLabel) {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-pressed={saved}
        onClick={toggle}
        onKeyDown={onKeyDown}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          fontSize: "var(--fs-body-sm)",
          fontWeight: 600,
          color: saved
            ? "var(--color-secondary-deep)"
            : "var(--color-text-muted)",
        }}
      >
        <Heart
          size={18}
          strokeWidth={2}
          fill={saved ? "currentColor" : "none"}
        />
        {label}
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={saved}
      onClick={toggle}
      onKeyDown={onKeyDown}
      style={{
        display: "grid",
        placeItems: "center",
        width: 36,
        height: 36,
        borderRadius: "var(--r-pill)",
        background: "color-mix(in srgb, var(--color-surface) 92%, transparent)",
        backdropFilter: "blur(4px)",
        boxShadow: "var(--shadow-sm)",
        cursor: "pointer",
        color: saved ? "var(--color-secondary)" : "var(--color-text-muted)",
        transition: "color 160ms var(--ease-out-expo)",
      }}
    >
      <Heart size={18} strokeWidth={2} fill={saved ? "currentColor" : "none"} />
    </span>
  );
}
