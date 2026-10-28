"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CtaButton } from "@/components/ui/cta-button";
import { bcp47 } from "@/lib/i18n/intl-locale";
import type { Locale } from "@/i18n/routing";

/**
 * Paying from the customer's own order page: an online order still waiting
 * for its money (how long the items are held, and a fresh try), or — `due` —
 * a credit / COD order still owed, which can be paid online now.
 * The signed-in session proves the order is theirs.
 */
export function OrderPayAgain({
  orderNumber,
  due = false,
  canPayAgain,
  holdUntil,
  attemptsLeft,
}: {
  orderNumber: string;
  due?: boolean;
  canPayAgain: boolean;
  holdUntil: string | null;
  attemptsLeft: number;
}) {
  const t = useTranslations("shop.confirmation");
  const locale = useLocale() as Locale;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Every click spends one of the order's tries: a double click must not.
  const inFlight = useRef(false);

  async function pay() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
        },
      );
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok && json.data.redirectUrl) {
        window.location.assign(json.data.redirectUrl);
        return;
      }
      const code = json?.error?.code;
      setError(
        code === "expired"
          ? t("expired")
          : code === "too_many_attempts"
            ? t("noMoreTries")
            : t("payAgainError"),
      );
    } catch {
      setError(t("payAgainError"));
    }
    inFlight.current = false;
    setBusy(false);
  }

  const until = holdUntil
    ? new Date(holdUntil).toLocaleTimeString(bcp47(locale), {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      role="status"
      style={{
        display: "grid",
        gap: "var(--s-3)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-6)",
      }}
    >
      {due ? (
        <>
          <span style={{ color: "var(--color-text-muted)" }}>
            {t("payNowNote")}
          </span>
          <div>
            <CtaButton onClick={pay}>
              {busy ? t("payingAgain") : t("payNow")}
            </CtaButton>
          </div>
        </>
      ) : (
        <strong style={{ color: "var(--color-text-strong)" }}>
          {t("titleAwaiting")}
        </strong>
      )}
      {due ? null : canPayAgain ? (
        <>
          {until ? (
            <span style={{ color: "var(--color-text-muted)" }}>
              {t("holdUntil", { time: until })}
            </span>
          ) : null}
          <div>
            <CtaButton onClick={pay}>
              {busy ? t("payingAgain") : t("payAgain")}
            </CtaButton>
          </div>
        </>
      ) : (
        <span style={{ color: "var(--color-text-muted)" }}>
          {attemptsLeft === 0 ? t("noMoreTries") : t("expired")}
        </span>
      )}
      {error ? (
        <span role="alert" style={{ color: "var(--color-error)" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
