"use client";

import type { ReactNode } from "react";

/** The small muted text link under an auth form ("← Back to sign in"). */
export function AuthLinkButton({
  onClick,
  children,
  strong = false,
}: {
  onClick: () => void;
  children: ReactNode;
  /** Brand-coloured, for the one action that moves the flow forward. */
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        font: "inherit",
        cursor: "pointer",
        padding: 0,
        fontSize: "var(--fs-small)",
        fontWeight: strong ? 600 : 400,
        color: strong ? "var(--color-brand-deep)" : "var(--color-text-muted)",
        textAlign: "center",
      }}
    >
      {children}
    </button>
  );
}

/** Inline field error, announced to screen readers; renders nothing when empty. */
export function FieldError({
  id,
  children,
}: {
  id: string;
  children?: ReactNode;
}) {
  if (!children) return null;
  return (
    <span
      id={id}
      role="alert"
      style={{ color: "var(--color-error)", fontSize: "var(--fs-small)" }}
    >
      {children}
    </span>
  );
}
