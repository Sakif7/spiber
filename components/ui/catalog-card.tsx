"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Placeholder, type Tone } from "@/components/ui/placeholder";

/**
 * CatalogCard — the shared catalog card, extracted 1:1 from the homepage
 * "capital equipment" card: teal-framed, hover-lift, an animated top accent bar
 * and a slow image zoom. Every catalog surface (Instruments, Marketplace,
 * Systems, MedAcademy) renders through this so the chrome is identical; only the
 * slotted content (label, title, footer, badges) differs per division.
 *
 * On hover a translucent brand-teal veil is drawn over the whole card.
 */
export function CatalogCard({
  href,
  image,
  imageAlt,
  placeholderLabel,
  placeholderTone = "teal",
  imageTopLeft,
  imageTopRight,
  topLabel,
  subLabel,
  title,
  belowTitle,
  details,
  footerLeft,
  action,
}: {
  href: string;
  image?: string | null;
  imageAlt: string;
  placeholderLabel: string;
  placeholderTone?: Tone;
  /** Absolutely-positioned badge in the image's top-left (e.g. "Featured", stock). */
  imageTopLeft?: ReactNode;
  /** Absolutely-positioned control in the image's top-right (e.g. wishlist). */
  imageTopRight?: ReactNode;
  /** Mono micro-label above the title (rendered uppercase). */
  topLabel?: ReactNode;
  /** Secondary caption between the eyebrow and the title (e.g. brand name). */
  subLabel?: ReactNode;
  title: ReactNode;
  /** Optional row between the title and footer (e.g. rating stars). */
  belowTitle?: ReactNode;
  /** Optional detail block (e.g. spec bullets) rendered above the footer. */
  details?: ReactNode;
  /** Footer's left cell (e.g. price or SKU). */
  footerLeft?: ReactNode;
  /** Footer's right cell — the call to action (e.g. "View"). Recolors on hover. */
  action: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: "var(--color-surface)",
        height: "100%",
        border: "1px solid " + (hover ? "var(--teal-300)" : "var(--teal-100)"),
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: hover ? "var(--shadow-brand)" : "var(--shadow-xs)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "all 280ms cubic-bezier(.16,1,.3,1)",
        cursor: "pointer",
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          zIndex: 3,
          background:
            "linear-gradient(90deg, var(--brand-teal), var(--aqua-400))",
          transform: hover ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left",
          transition: "transform 420ms cubic-bezier(.16,1,.3,1)",
        }}
      />
      <div
        className="cc-media"
        style={{ position: "relative", height: 160, overflow: "hidden" }}
      >
        {image ? (
          <Image
            src={image}
            alt={imageAlt}
            fill
            sizes="(max-width: 768px) 100vw, 300px"
            style={{
              objectFit: "cover",
              transform: hover ? "scale(1.06)" : "scale(1)",
              transition: "transform 600ms cubic-bezier(.16,1,.3,1)",
            }}
          />
        ) : (
          <Placeholder
            label={placeholderLabel}
            tone={placeholderTone}
            style={{
              width: "100%",
              height: "100%",
              transform: hover ? "scale(1.06)" : "scale(1)",
              transition: "transform 600ms cubic-bezier(.16,1,.3,1)",
            }}
          />
        )}
        {imageTopLeft != null && (
          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 3 }}>
            {imageTopLeft}
          </div>
        )}
        {imageTopRight != null && (
          <div style={{ position: "absolute", top: 12, right: 12, zIndex: 3 }}>
            {imageTopRight}
          </div>
        )}
      </div>
      <div
        className="cc-body"
        style={{
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: 1,
        }}
      >
        {topLabel != null && topLabel !== "" && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
            }}
          >
            {topLabel}
          </div>
        )}
        {subLabel != null && subLabel !== "" && subLabel}
        <div
          className="cc-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--color-text-strong)",
            letterSpacing: "-.01em",
          }}
        >
          {title}
        </div>
        {belowTitle}
        {details}
        <div
          className="cc-foot"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            // Wrap on very narrow cards (2-up phones) so the price and CTA
            // never collide — the CTA drops to its own line instead.
            flexWrap: "wrap",
            marginTop: 8,
            paddingTop: 12,
            borderTop: "1px solid var(--teal-100)",
          }}
        >
          <span style={{ minWidth: 0 }}>{footerLeft}</span>
          <span
            className="cc-action"
            style={{
              flexShrink: 0,
              whiteSpace: "nowrap",
              fontSize: 12,
              fontWeight: 500,
              color: hover
                ? "var(--color-brand-deep)"
                : "var(--color-text-muted)",
            }}
          >
            {action}
          </span>
        </div>
      </div>
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 4,
          pointerEvents: "none",
          background: "var(--brand-teal)",
          opacity: hover ? 0.1 : 0,
          transition: "opacity 280ms cubic-bezier(.16,1,.3,1)",
        }}
      />
    </Link>
  );
}
