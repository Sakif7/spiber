"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { CtaButton } from "@/components/ui/cta-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/components/auth/use-session";
import { useAuthModal } from "@/components/auth/auth-modal";

export function ReviewForm({ productId }: { productId: string }) {
  const t = useTranslations("reviews");
  const { user } = useSession();
  const { open: openAuth } = useAuthModal();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div style={panel}>
        <p style={{ color: "var(--color-text-muted)" }}>{t("signInPrompt")}</p>
        <CtaButton variant="secondary" onClick={() => openAuth("login")}>
          {t("signIn")}
        </CtaButton>
      </div>
    );
  }

  if (done) {
    return (
      <div style={panel}>
        <p style={{ color: "var(--color-success)", fontWeight: 600 }}>
          ✓ {t("submitted")}
        </p>
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-body-sm)",
          }}
        >
          {t("pendingNote")}
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError(t("ratingRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/marketplace/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        rating,
        title: title || undefined,
        body,
      }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && json?.ok) {
      setDone(true);
    } else if (json?.error?.code === "already_reviewed") {
      setError(t("alreadyReviewed"));
    } else {
      setError(t("error"));
    }
  }

  return (
    <form onSubmit={submit} style={{ ...panel, gap: "var(--s-4)" }}>
      <h3
        style={{
          margin: 0,
          color: "var(--color-text-strong)",
          fontSize: "var(--fs-h6)",
        }}
      >
        {t("writeTitle")}
      </h3>
      <div style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${i} star`}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              lineHeight: 0,
            }}
          >
            <Star
              size={24}
              strokeWidth={1.6}
              color="var(--color-secondary)"
              fill={
                (hover || rating) >= i
                  ? "var(--color-secondary)"
                  : "transparent"
              }
            />
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <Label>{t("titleLabel")}</Label>
        <Input
          value={title}
          maxLength={140}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <Label>{t("bodyLabel")}</Label>
        <textarea
          value={body}
          required
          rows={4}
          maxLength={4000}
          onChange={(e) => setBody(e.target.value)}
          style={{
            font: "inherit",
            padding: "8px 10px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-sm)",
            background: "var(--color-surface)",
            width: "100%",
            resize: "vertical",
          }}
        />
      </div>
      {error && (
        <span style={{ color: "var(--color-error)", fontSize: "var(--fs-sm)" }}>
          {error}
        </span>
      )}
      <CtaButton type="submit" style={{ opacity: busy ? 0.7 : 1 }}>
        {busy ? t("submitting") : t("submit")}
      </CtaButton>
    </form>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  padding: "var(--s-5)",
  display: "grid",
  gap: "var(--s-3)",
};
