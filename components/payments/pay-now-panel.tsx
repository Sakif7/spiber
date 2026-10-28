"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The confirming page asks again this often, this many times, then stops. */
const POLL_MS = 3000;
const POLL_TIMES = 10;

/**
 * "Pay now": a fresh try at PayStation for the customer's own pending
 * software purchase or course enrollment, or for a pay link (`/pay/<token>`,
 * no sign-in). After a return from the gateway it words what happened
 * (`hint`, set by our return route after asking PayStation) and, while a
 * payment is still being confirmed, refreshes the page until it turns paid.
 */
export function PayNowPanel({
  kind,
  reference,
  askPhone: askPhoneAtFirst,
  hint,
}: {
  kind: "software" | "enrollment" | "link";
  /** The purchase or enrollment number, or the link's token. */
  reference: string;
  /** We have no phone for the payer, and PayStation needs one. */
  askPhone: boolean;
  hint?: string;
}) {
  const t = useTranslations("payments");
  const tc = useTranslations("shop.confirmation");
  const tm = useTranslations("shop.checkout");
  const locale = useLocale();
  const router = useRouter();
  const [askPhone, setAskPhone] = useState(askPhoneAtFirst);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  // Every click starts a PayStation invoice: a double click must not.
  const inFlight = useRef(false);

  const confirming = hint === "pending" && !gaveUp;
  useEffect(() => {
    if (!confirming) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= POLL_TIMES) {
        clearInterval(id);
        setGaveUp(true);
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [confirming, router]);

  async function pay() {
    if (inFlight.current) return;
    if (askPhone && phone.trim().length < 6) {
      setError(t("phoneHint"));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const typed = askPhone ? phone.trim() : undefined;
      const res = await fetch(
        kind === "link"
          ? `/api/payments/link/${encodeURIComponent(reference)}`
          : "/api/payments/start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            kind === "link"
              ? { phone: typed, locale }
              : { kind, ref: reference, phone: typed, locale },
          ),
        },
      );
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok && json.data.redirectUrl) {
        window.location.assign(json.data.redirectUrl);
        return;
      }
      const code = json?.error?.code;
      if (code === "phone_required" || code === "invalid_input") {
        setAskPhone(true);
        setError(t("phoneHint"));
      } else if (code === "too_many_attempts") {
        setError(t("noMoreTries"));
      } else if (
        code === "closed" ||
        code === "outdated" ||
        code === "unavailable"
      ) {
        // The link changed under the payer: the page says how.
        router.refresh();
      } else {
        setError(tc("payAgainError"));
      }
    } catch {
      setError(tc("payAgainError"));
    }
    inFlight.current = false;
    setBusy(false);
  }

  const line = confirming
    ? tc("paymentPending")
    : hint === "pending"
      ? tc("paymentUnconfirmed")
      : hint === "cancelled"
        ? tc("paymentCancelled")
        : hint === "failed"
          ? tc("paymentFailed")
          : hint === "issue"
            ? tc("paymentIssue")
            : null;

  return (
    <div
      role="status"
      style={{
        display: "grid",
        gap: "var(--s-3)",
        padding: "var(--s-5)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--r-lg)",
        background: "var(--color-surface)",
        textAlign: "left",
      }}
    >
      {line ? (
        <p style={{ margin: 0, fontSize: "var(--fs-body-lg)" }}>{line}</p>
      ) : null}
      {!confirming ? (
        <>
          <p
            style={{
              margin: 0,
              color: "var(--color-text-muted)",
              fontSize: "var(--fs-small)",
            }}
          >
            {tm("payOnlineNote")}
          </p>
          {askPhone ? (
            <div style={{ display: "grid", gap: 6 }}>
              <Label htmlFor="pay-phone">{t("phoneLabel")}</Label>
              <Input
                id="pay-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
              />
            </div>
          ) : null}
          <div>
            <CtaButton onClick={pay}>
              {busy ? tc("payingAgain") : t("payNow")}
            </CtaButton>
          </div>
        </>
      ) : null}
      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            color: "var(--color-error)",
            fontSize: "var(--fs-small)",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
