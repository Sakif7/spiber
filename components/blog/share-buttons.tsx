"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { useTranslations } from "next-intl";

export function ShareButtons({ title }: { title: string }) {
  const t = useTranslations("blog");
  const [copied, setCopied] = useState(false);

  function urlNow() {
    return typeof window !== "undefined" ? window.location.href : "";
  }
  function open(href: string) {
    window.open(href, "_blank", "noopener,noreferrer");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(urlNow());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const linkStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: "var(--r-pill)",
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    color: "var(--color-text-muted)",
    fontSize: "var(--fs-body-sm)",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: "var(--fs-body-sm)",
          color: "var(--color-text-muted)",
        }}
      >
        {t("share")}
      </span>
      <button
        type="button"
        style={linkStyle}
        onClick={() =>
          open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(urlNow())}`,
          )
        }
      >
        X
      </button>
      <button
        type="button"
        style={linkStyle}
        onClick={() =>
          open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlNow())}`,
          )
        }
      >
        Facebook
      </button>
      <button
        type="button"
        style={linkStyle}
        onClick={() =>
          open(
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(urlNow())}`,
          )
        }
      >
        LinkedIn
      </button>
      <button type="button" style={linkStyle} onClick={copy}>
        {copied ? <Check size={14} /> : <Link2 size={14} />}
        {copied ? t("copied") : t("copyLink")}
      </button>
    </div>
  );
}
