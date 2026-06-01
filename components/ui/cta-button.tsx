"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";

type Variant = "primary" | "secondary" | "ghost";

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: Variant;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
};

const base: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 44,
  padding: "0 18px",
  borderRadius: "var(--r-pill)",
  fontSize: 14,
  fontWeight: 500,
  fontFamily: "var(--font-body)",
  border: "1px solid transparent",
  cursor: "pointer",
  textDecoration: "none",
  transition:
    "transform 220ms var(--ease-out-expo), box-shadow 220ms var(--ease-out-expo), background 220ms, color 220ms, border-color 220ms",
};

function variantStyle(variant: Variant, hover: boolean): CSSProperties {
  switch (variant) {
    case "secondary":
      return {
        background: hover ? "var(--color-surface-2)" : "transparent",
        color: "var(--color-text-strong)",
        borderColor: "var(--color-border)",
      };
    case "ghost":
      return {
        background: "transparent",
        color: hover ? "var(--color-brand-deep)" : "var(--color-text-muted)",
      };
    default:
      return {
        background: "var(--color-brand)",
        color: "#fff",
        boxShadow: hover ? "var(--shadow-lg)" : "var(--shadow-brand)",
      };
  }
}

export function CtaButton({
  children,
  href,
  onClick,
  type = "button",
  variant = "primary",
  className,
  style,
  ...rest
}: Props) {
  const [hover, setHover] = useState(false);
  const composed: CSSProperties = {
    ...base,
    ...variantStyle(variant, hover),
    transform: hover && variant === "primary" ? "translateY(-2px)" : "none",
    ...style,
  };
  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        style={composed}
        aria-label={rest["aria-label"]}
        {...handlers}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      onClick={onClick}
      className={className}
      style={composed}
      aria-label={rest["aria-label"]}
      {...handlers}
    >
      {children}
    </button>
  );
}
